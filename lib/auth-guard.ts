/**
 * The access guards — the security core of ScoreFlow.
 * (Milestone 5; extended for chains in M16; rebuilt on a safe foundation in M17.)
 *
 * These are the "Data Access Layer" checks the Next.js docs recommend: the
 * authorization decision lives right next to the data, on the server, so it runs
 * on every request and can't be skipped by the browser.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  THE RULE (Milestone 17):                                                 ║
 * ║      The TOKEN says who you are. The DATABASE says what you may see.      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * ── Why. Two real holes this closes ──────────────────────────────────────────
 *
 * Before M17 the guard authorized by comparing a SLUG STRING that had been baked
 * into the session cookie at login:
 *
 *     if (user.restaurantSlug === slug) → allowed        // ← the bug
 *
 * Because sessions are stateless JWTs, that string was never re-checked against
 * anything. Two consequences, both exploitable:
 *
 *   1. NOTHING COULD BE REVOKED. Fire a manager, reset their password — their
 *      browser kept working for up to 30 days, because their cookie still said
 *      "acme" and nobody ever asked the database whether that was still true.
 *      Password reset was the only lockout lever the product had, and it revoked
 *      precisely nothing.
 *
 *   2. A STALE COOKIE COULD REACH A DIFFERENT TENANT. Slugs are editable and
 *      re-usable. Rename restaurant "acme" (or delete it when a customer churns),
 *      then onboard a NEW customer who takes the slug "acme" — and the old owner's
 *      month-old cookie now opens the new customer's dashboard. The check passes,
 *      because the check was only ever `"acme" === "acme"`.
 *
 * Both vanish once the guard re-reads the account on every request and compares
 * NUMERIC IDs against freshly-loaded rows. Slugs become cosmetic: renaming or
 * re-using one grants nobody anything.
 *
 * ── What every guard now does ────────────────────────────────────────────────
 *   1. Read the session → get `accountId` + `kind` + `tokenVersion` (identity).
 *   2. Load that account from the DB.
 *        • row gone?              → session dead (a deleted owner is locked out at once)
 *        • tokenVersion moved?    → session dead (password change/reset kicks out
 *                                   EVERY device, everywhere — that's the point)
 *   3. Authorize by comparing numeric FKs on the rows we just loaded.
 *
 * Cost: one indexed primary-key lookup per protected request. The guards already
 * hit the database to resolve the restaurant, so this is noise.
 *
 * Who may view a branch dashboard (`/r/[slug]/dashboard` and `/tables`):
 *   • a BRANCH MANAGER  → only their one branch;
 *   • a BRAND OWNER     → any branch OF THEIR OWN BRAND (never another brand's);
 *   • an operator       → no (the operator uses /admin).
 * Who may view the brand console (`/b/[brandSlug]`): the brand's owner, only.
 */

import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerById } from "@/lib/owners";
import { getOperatorById } from "@/lib/operators";
import { brandOwnerHome } from "@/lib/brands";
import {
  subscriptionState,
  type SubscriptionState,
} from "@/lib/subscriptions";

export type SessionUser = {
  role?: "operator" | "brand" | "owner";
  restaurantSlug?: string;
  brandId?: number;
  brandSlug?: string;
  email?: string | null;
};

/**
 * Where a signed-in visitor's "home" is, by role. Used both when someone lands
 * somewhere they can't access (→ "Go back") and when an already-signed-in visitor
 * opens /login (→ skip the form). Returns "/login" when we can't place them.
 *
 * This is a NAVIGATION helper, not a security one — it's fine for it to read the
 * session's (possibly stale) slugs, because the worst case is an unhelpful link.
 */
export function homeHrefFor(user: SessionUser): string {
  if (user.role === "operator") return "/operator";
  if (user.role === "brand" && user.brandSlug) return `/b/${user.brandSlug}`;
  if (user.role === "owner" && user.restaurantSlug) {
    return `/r/${user.restaurantSlug}/dashboard`;
  }
  return "/login";
}

// ── Step 1+2: who is really signed in, according to the DATABASE ─────────────

type LoadedOwner = NonNullable<Awaited<ReturnType<typeof getOwnerById>>>;
type LoadedOperator = NonNullable<Awaited<ReturnType<typeof getOperatorById>>>;

type Account =
  | { kind: "operator"; operator: LoadedOperator }
  | { kind: "owner"; owner: LoadedOwner };

/**
 * Resolve the CURRENT account from the database, or `null` if the session is
 * absent, malformed, or revoked.
 *
 * This is the single choke point where a session is validated. Every guard below
 * starts here, so there is exactly one place to get revocation right.
 */
async function currentAccount(): Promise<Account | null> {
  const session = await auth();
  const user = session?.user;

  // Identity must be present. (Sessions minted before M17 have no `accountId`, so
  // they fail here — that's why everyone is signed out once on release.)
  if (!user?.accountId || !user.kind || typeof user.tokenVersion !== "number") {
    return null;
  }

  if (user.kind === "operator") {
    const operator = await getOperatorById(user.accountId);
    // Deleted account, or password rotated since this token was minted → dead.
    if (!operator || operator.tokenVersion !== user.tokenVersion) return null;
    return { kind: "operator", operator };
  }

  const owner = await getOwnerById(user.accountId);
  if (!owner || owner.tokenVersion !== user.tokenVersion) return null;
  return { kind: "owner", owner };
}

/**
 * The signed-in visitor's home, or `null` if they aren't validly signed in.
 *
 * `/login` uses this to skip the form for someone who's already in. It MUST be a
 * database-backed check, not just "does the cookie decode?" — otherwise a revoked
 * session (e.g. right after changing your own password, which bumps
 * `tokenVersion`) would still look signed-in to /login, get bounced to the
 * dashboard, get bounced back to /login by the guard, and loop forever.
 */
export async function signedInHomeHref(): Promise<string | null> {
  const account = await currentAccount();
  return account ? homeHrefForAccount(account) : null;
}

/**
 * The subscription that governs a restaurant, or `null` if it's a legacy
 * standalone (no brand → comped, never gated). Used by the guards to lock a
 * lapsed account out of the private dashboards. Milestone 20.
 */
type GoverningBrand = {
  subStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
} | null;

function gateFor(brand: GoverningBrand): SubscriptionState | null {
  if (!brand) return null; // legacy/standalone → comped
  const state = subscriptionState(brand);
  return state.live ? null : state; // null = fine; a state = blocked
}

/**
 * Home href derived from the FRESH database row (not the session's snapshot).
 *
 * Async because a brand owner's home depends on how many locations they have
 * (single venue → their restaurant dashboard; 2+ → the console) — see
 * `brandOwnerHome`.
 */
async function homeHrefForAccount(account: Account): Promise<string> {
  // The operator's home is their SALES dashboard (M21), not the ops toolbox.
  if (account.kind === "operator") return "/operator";
  const { owner } = account;
  if (owner.brandId && owner.brand) {
    return brandOwnerHome(owner.brandId, owner.brand.slug);
  }
  if (owner.restaurantId && owner.restaurant) {
    return `/r/${owner.restaurant.slug}/dashboard`;
  }
  return "/login";
}

// ── Branch dashboard / tables ────────────────────────────────────────────────

export type DashboardAccess =
  | {
      authorized: true;
      ownerEmail: string;
      restaurantSlug: string;
      /** True for the ACCOUNT OWNER; false for a branch manager they employ. Only
       *  the account owner may add locations or close the account (M22). */
      isAccountOwner: boolean;
      /** The account's slug, for linking to the multi-location console. */
      accountSlug: string | null;
    }
  | { authorized: false; reason: "unauthorized"; homeHref: string }
  | { authorized: false; reason: "subscription"; state: SubscriptionState };

/**
 * May the current visitor view the branch at `slug`?
 *
 * - Not logged in, or session revoked → REDIRECTS to /login (never returns).
 * - Logged in but not allowed → `{ reason: "unauthorized", homeHref }`; the caller
 *   renders "Not authorized" — and returns BEFORE loading any of that branch's
 *   data, so nothing leaks.
 * - Own restaurant but the account's TRIAL/SUBSCRIPTION has lapsed →
 *   `{ reason: "subscription", state }`; the caller renders a "subscribe" screen.
 * - Allowed (own branch, or a branch of the brand you own, and paid/on-trial) →
 *   `{ authorized: true }`.
 */
export async function requireDashboardAccess(
  slug: string
): Promise<DashboardAccess> {
  const account = await currentAccount();
  if (!account) {
    redirect("/login");
  }

  const denied = async () => ({
    authorized: false as const,
    reason: "unauthorized" as const,
    homeHref: await homeHrefForAccount(account),
  });

  // The operator is not an owner of branch pages — they use /admin.
  if (account.kind === "operator") return denied();

  const { owner } = account;

  // Resolve the restaurant in the URL against the DB, WITH its brand (the brand is
  // the paying account, so it carries the subscription). We compare IDs, never the
  // slug, so a renamed or re-used slug can't be used to walk into another tenant.
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { brand: true },
  });
  if (!restaurant) return denied(); // unknown slug — reveal nothing

  // Which kind of owner is this? Derived from the DATABASE row, not the session,
  // so re-scoping an account takes effect on their very next request.
  const isBrandOwner = owner.brandId !== null && owner.brand !== null;

  const allowed = isBrandOwner
    ? // Brand owner → any branch that belongs to THEIR brand.
      restaurant.brandId !== null && restaurant.brandId === owner.brandId
    : // Branch manager → only their own single branch.
      owner.restaurantId !== null && restaurant.id === owner.restaurantId;

  if (!allowed) return denied();

  // Authorized to SEE it — but is the account still paid up? The subscription
  // lives on the brand; a lapsed account locks the whole team out of the private
  // dashboard (the public feedback page is never gated — see the feedback route).
  const blocked = gateFor(restaurant.brand);
  if (blocked) {
    return { authorized: false, reason: "subscription", state: blocked };
  }

  return {
    authorized: true,
    ownerEmail: owner.email,
    restaurantSlug: restaurant.slug,
    isAccountOwner: isBrandOwner,
    accountSlug: restaurant.brand?.slug ?? null,
  };
}

// ── The account owner (M22) ──────────────────────────────────────────────────

export type AccountOwnerAccess =
  | {
      authorized: true;
      ownerEmail: string;
      brandId: number;
      brandSlug: string;
      brandName: string;
    }
  | { authorized: false; homeHref: string };

/**
 * Is the visitor the OWNER of an account (not a branch manager they employ)?
 *
 * Used by the "close my account" page. Two deliberate properties:
 *
 *   • A BRANCH MANAGER is refused. They run one location; they must never be able
 *     to delete the whole company out from under their employer.
 *
 *   • It is NOT subscription-gated — on purpose. Every other private page locks
 *     when a trial lapses, but if closing your account locked too, a lapsed
 *     customer would be trapped in a room with no exit: unable to use the product
 *     AND unable to leave or take their data out. You must always be able to go.
 */
export async function requireAccountOwner(): Promise<AccountOwnerAccess> {
  const account = await currentAccount();
  if (!account) {
    redirect("/login");
  }

  if (account.kind === "operator") {
    return { authorized: false, homeHref: await homeHrefForAccount(account) };
  }

  const { owner } = account;
  if (!owner.brandId || !owner.brand) {
    // A branch manager — not their account to close.
    return { authorized: false, homeHref: await homeHrefForAccount(account) };
  }

  return {
    authorized: true,
    ownerEmail: owner.email,
    brandId: owner.brandId,
    brandSlug: owner.brand.slug,
    brandName: owner.brand.name,
  };
}

// ── Brand console ─────────────────────────────────────────────────────────────

export type BrandAccess =
  | { authorized: true; ownerEmail: string; brandSlug: string }
  | { authorized: false; reason: "unauthorized"; homeHref: string }
  | { authorized: false; reason: "subscription"; state: SubscriptionState };

/**
 * May the current visitor use the brand console at `/b/[brandSlug]`?
 * Only the brand's own brand-owner, and only while the account is paid/on-trial.
 */
export async function requireBrandAccess(
  brandSlug: string
): Promise<BrandAccess> {
  const account = await currentAccount();
  if (!account) {
    redirect("/login");
  }

  const denied = async () => ({
    authorized: false as const,
    reason: "unauthorized" as const,
    homeHref: await homeHrefForAccount(account),
  });

  if (account.kind === "operator") return denied();

  const { owner } = account;
  if (!owner.brandId) return denied(); // a branch manager has no brand console

  // Same principle as above: resolve the brand and compare NUMERIC ids.
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand || brand.id !== owner.brandId) return denied();

  const blocked = gateFor(brand);
  if (blocked) {
    return { authorized: false, reason: "subscription", state: blocked };
  }

  return { authorized: true, ownerEmail: owner.email, brandSlug: brand.slug };
}

// ── Operator admin ────────────────────────────────────────────────────────────

export type OperatorAccess =
  | { authorized: true; operatorEmail: string }
  | { authorized: false; homeHref: string };

/**
 * May the current visitor use an operator area (`/operator`, `/admin`)? Operators
 * only.
 *
 * Note the redirect target (M21): a signed-out visitor is sent to the OPERATOR's
 * own login door, not the customers' one. The two are separate front doors for the
 * same hardened auth backend — the real protection is this role check, not the URL.
 */
export async function requireOperator(): Promise<OperatorAccess> {
  const account = await currentAccount();
  if (!account) {
    redirect("/operator/login");
  }

  if (account.kind !== "operator") {
    return { authorized: false, homeHref: await homeHrefForAccount(account) };
  }

  return { authorized: true, operatorEmail: account.operator.email };
}
