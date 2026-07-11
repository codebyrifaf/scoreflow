/**
 * The access guards — the security core of ScoreFlow (Milestone 5; extended for
 * chains in Milestone 16).
 *
 * These are the "Data Access Layer" checks the Next.js docs recommend: the
 * authorization decision lives right next to the data, on the server, so it runs
 * on every request and can't be skipped by the browser. Every scope comes from
 * the SIGNED session (set server-side at login) — never from anything the browser
 * sends — so nobody can widen their access by editing a URL.
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
import { getRestaurantBySlug } from "@/lib/restaurants";

type SessionUser = {
  role?: "operator" | "brand" | "owner";
  restaurantSlug?: string;
  brandId?: number;
  brandSlug?: string;
  email?: string | null;
};

/** Where to send a signed-in visitor who lands somewhere they can't access. */
function homeHrefFor(user: SessionUser): string {
  if (user.role === "operator") return "/admin";
  if (user.role === "brand" && user.brandSlug) return `/b/${user.brandSlug}`;
  if (user.role === "owner" && user.restaurantSlug) {
    return `/r/${user.restaurantSlug}/dashboard`;
  }
  return "/login";
}

// ── Branch dashboard / tables ────────────────────────────────────────────────

export type DashboardAccess =
  | { authorized: true; ownerEmail: string; restaurantSlug: string }
  | { authorized: false; homeHref: string };

/**
 * May the current visitor view the branch at `slug`?
 *
 * - Not logged in → REDIRECTS to /login (never returns).
 * - Logged in but not allowed → `{ authorized: false, homeHref }`; the caller
 *   renders "Not authorized" — and returns BEFORE loading any of that branch's
 *   data, so nothing leaks.
 * - Allowed (own branch, or a branch of the brand you own) → `{ authorized: true }`.
 */
export async function requireDashboardAccess(
  slug: string
): Promise<DashboardAccess> {
  const session = await auth();
  if (!session?.user?.role) {
    redirect("/login");
  }
  const user = session.user;
  const denied = { authorized: false as const, homeHref: homeHrefFor(user) };

  // Branch manager: only their own branch.
  if (user.role === "owner") {
    if (user.restaurantSlug && user.restaurantSlug === slug) {
      return {
        authorized: true,
        ownerEmail: user.email ?? "",
        restaurantSlug: slug,
      };
    }
    return denied;
  }

  // Brand owner: any branch that belongs to THEIR brand. We look the restaurant
  // up server-side and compare brandId — never trust the URL alone.
  if (user.role === "brand" && user.brandId) {
    const restaurant = await getRestaurantBySlug(slug);
    if (restaurant && restaurant.brandId === user.brandId) {
      return {
        authorized: true,
        ownerEmail: user.email ?? "",
        restaurantSlug: slug,
      };
    }
    return denied;
  }

  // Operator (or anything else) is not an owner of branch pages.
  return denied;
}

// ── Brand console ─────────────────────────────────────────────────────────────

export type BrandAccess =
  | { authorized: true; ownerEmail: string; brandSlug: string }
  | { authorized: false; homeHref: string };

/**
 * May the current visitor use the brand console at `/b/[brandSlug]`?
 * Only the brand's own brand-owner. Everyone else → not authorized.
 */
export async function requireBrandAccess(
  brandSlug: string
): Promise<BrandAccess> {
  const session = await auth();
  if (!session?.user?.role) {
    redirect("/login");
  }
  const user = session.user;

  if (user.role === "brand" && user.brandSlug === brandSlug) {
    return { authorized: true, ownerEmail: user.email ?? "", brandSlug };
  }
  return { authorized: false, homeHref: homeHrefFor(user) };
}

// ── Operator admin ────────────────────────────────────────────────────────────

export type OperatorAccess =
  | { authorized: true; operatorEmail: string }
  | { authorized: false; homeHref: string };

/**
 * May the current visitor use the operator admin area (`/admin`)? Operators only.
 */
export async function requireOperator(): Promise<OperatorAccess> {
  const session = await auth();
  if (!session?.user?.role) {
    redirect("/login");
  }
  const user = session.user;

  if (user.role !== "operator") {
    return { authorized: false, homeHref: homeHrefFor(user) };
  }
  return { authorized: true, operatorEmail: user.email ?? "" };
}
