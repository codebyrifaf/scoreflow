/**
 * Brand data access (Milestone 16 — multi-location chains).
 *
 * A Brand groups several branches (each branch is a `Restaurant`). Everything here
 * is the one place that reads/writes brands and rolls up per-branch stats for the
 * brand-owner console at /b/[brandSlug].
 */

import { prisma } from "./prisma";
import { newTrialEndsAt } from "./subscriptions";
import { slugify } from "./slug";

/** Look up a brand by its URL slug (e.g. "kfc"), or null. */
export async function getBrandBySlug(slug: string) {
  return prisma.brand.findUnique({ where: { slug } });
}

/**
 * Set (or clear) a brand's logo (Milestone 26). The logo is stored as a small
 * data: URL and shown on every branch's diner-facing feedback page. `null` removes
 * it (the feedback page falls back to the initial-on-a-disc placeholder). The
 * caller validates the data URL's size + type first — see the settings action.
 */
export async function updateBrandLogo(
  brandId: number,
  logoDataUrl: string | null
) {
  return prisma.brand.update({
    where: { id: brandId },
    data: { logoDataUrl },
  });
}

/**
 * Where a brand OWNER's home is (Milestone 20 — single-venue routing).
 *
 * The account model reuses `Brand` for everyone, but a customer with ONE location
 * shouldn't be dropped into a "chain" console — they should just land on their
 * restaurant's dashboard and never see brand/branch language. So:
 *   • ZERO restaurants     → the console, which shows "add your first location".
 *     This is where a customer lands the moment they finish signing up, now that
 *     signup creates the account only (see `createAccountFromSignup`).
 *   • exactly 1 restaurant → that restaurant's dashboard;
 *   • 2 or more            → the multi-location console.
 */
export async function brandOwnerHome(
  brandId: number,
  brandSlug: string
): Promise<string> {
  const restaurants = await prisma.restaurant.findMany({
    where: { brandId },
    select: { slug: true },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (restaurants.length === 1) {
    return `/r/${restaurants[0].slug}/dashboard`;
  }
  return `/b/${brandSlug}`;
}

// NOTE (M22): `getAllBrandsForAdmin()` fed the retired `/admin` area. The operator
// no longer manages customer accounts at all — see lib/operator-stats.ts for what
// they DO see (money + usage, never content).

/** Brand-wide totals for the overview cards. */
export async function getBrandStats(brandId: number) {
  const [branchCount, agg] = await Promise.all([
    prisma.restaurant.count({ where: { brandId } }),
    prisma.feedback.aggregate({
      where: { restaurant: { brandId } },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  return {
    branchCount,
    responseCount: agg._count._all,
    avgRating: agg._avg.rating, // number | null
  };
}

/** Each branch of a brand, with per-branch stats — the comparison cards. */
export async function getBranchesForBrand(brandId: number) {
  const branches = await prisma.restaurant.findMany({
    where: { brandId },
    orderBy: { createdAt: "asc" },
    include: {
      owners: { select: { email: true }, orderBy: { id: "asc" } },
      _count: { select: { feedback: true, tables: true } },
    },
  });

  // Per-branch average rating in one grouped query.
  const grouped =
    branches.length === 0
      ? []
      : await prisma.feedback.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: branches.map((b) => b.id) } },
          _avg: { rating: true },
        });
  const avgById = new Map(grouped.map((g) => [g.restaurantId, g._avg.rating]));

  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    // Review links aren't shown in the brand console (M35) — they live in each
    // branch's Settings — so they're not fetched here.
    positiveThreshold: b.positiveThreshold,
    responses: b._count.feedback,
    tables: b._count.tables,
    managerEmails: b.owners.map((o) => o.email),
    avgRating: avgById.get(b.id) ?? null,
  }));
}

// NOTE (M22): `createBrandWithOwner()` was how the OPERATOR hand-created an account.
// Accounts are now born from a verified self-serve signup — see
// `createAccountFromSignup()` above, which is the only way an account comes into
// existence. (If the operator is standing in the restaurant, they just fill in the
// signup form WITH the owner, so the account is the customer's from minute one.)

/**
 * Create a brand-new self-serve ACCOUNT from a verified signup (Milestone 20).
 *
 * One transaction creates the two rows that ARE the account:
 *   • a `Brand` — the paying account, started on a 14-day free TRIAL;
 *   • the owner `Owner` — brand-scoped, already `emailVerified` (the OTP is how we
 *     got here). Given instant-alert defaults: a brand-new account has one location
 *     at most, so the owner is effectively its manager and wants to hear about an
 *     unhappy diner right away (they can switch to a digest once they add locations).
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️ NO RESTAURANT IS CREATED HERE, AND THAT IS THE POINT.                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * This used to also create ONE `Restaurant` from the same name, and that quietly
 * broke the whole model:
 *
 *   • that first restaurant had NO branch manager, while every location added later
 *     (via `addBranch`) got one — so location #1 was structurally unlike #2;
 *   • it was born from a DIFFERENT code path, so the two drifted;
 *   • the account and the venue shared one name, so an owner whose company and first
 *     branch differ ("Uncle Bobo's" vs "Uncle Bobo's Dhanmondi") had to rename one
 *     of them by hand — and in the real account, ended up with two identically-named
 *     restaurants 24 minutes apart.
 *
 * An account is a COMPANY. A restaurant is a LOCATION under it. Signing up gives you
 * the company; you then add locations — the first and the tenth through exactly the
 * same door (`addBranch`), which asks who runs each one.
 *
 * A brand with ZERO restaurants is a legal, expected state: `brandOwnerHome` sends
 * such an owner to the console, and every brand-wide aggregate already copes with an
 * empty branch list.
 *
 * The caller has already checked the email is free and verified the code.
 */
export async function createAccountFromSignup(input: {
  ownerEmail: string;
  ownerPasswordHash: string;
  businessName: string;
}) {
  // Resolve a unique brand slug BEFORE opening the transaction (it does its own
  // reads). Restaurant slugs are resolved separately, when a location is added.
  const base = slugify(input.businessName);
  let brandSlug = base;
  let n = 1;
  while (await prisma.brand.findUnique({ where: { slug: brandSlug } })) {
    n += 1;
    brandSlug = `${base}-${n}`.slice(0, 40);
  }

  return prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: {
        name: input.businessName,
        slug: brandSlug,
        subStatus: "trialing",
        trialEndsAt: newTrialEndsAt(),
      },
    });

    await tx.owner.create({
      data: {
        email: input.ownerEmail,
        passwordHash: input.ownerPasswordHash,
        brandId: brand.id,
        emailVerified: true,
        // One-location owner → wants the instant alert, not a digest.
        alertsEnabled: true,
        digestEnabled: false,
      },
    });

    return { brand };
  });
}

/**
 * Permanently delete a brand AND everything under it (Milestone 16 — operator
 * cascade delete). This removes the brand, ALL its branches, and every branch's
 * feedback, tables, and manager login, plus the brand-owner login itself.
 *
 * ⚠️ Irreversible. Like restaurants, the foreign keys are ON DELETE RESTRICT, so
 * we must delete children before their parents. Everything runs inside ONE
 * interactive `$transaction` — all-or-nothing, so any failure rolls the whole
 * thing back and you can never end up half-deleted. Only the operator calls this,
 * and only after a typed-slug confirmation in the UI + a re-check in the action.
 */
export async function deleteBrandCascade(brandId: number) {
  return prisma.$transaction(async (tx) => {
    // The brand's branches (each branch is a Restaurant). We need their ids to
    // delete their children (feedback/tables/managers) first.
    const branches = await tx.restaurant.findMany({
      where: { brandId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    // 1) Children of every branch (empty `in: []` simply matches nothing).
    await tx.feedback.deleteMany({ where: { restaurantId: { in: branchIds } } });
    await tx.table.deleteMany({ where: { restaurantId: { in: branchIds } } });
    // Orders pushed by each branch's till. Same ON DELETE RESTRICT trap as
    // `Payment` below — miss this and any account whose POS ever sent an order
    // becomes undeletable.
    await tx.posOrder.deleteMany({ where: { restaurantId: { in: branchIds } } });
    await tx.owner.deleteMany({ where: { restaurantId: { in: branchIds } } }); // branch managers

    // 2) The branches themselves, then the brand-owner login(s).
    await tx.restaurant.deleteMany({ where: { brandId } });
    await tx.owner.deleteMany({ where: { brandId } });

    // 3) The account's PAYMENT ledger (Milestone 21). This FK is ON DELETE
    //    RESTRICT like every other, so forgetting it here would make deleting any
    //    account that ever paid us fail outright.
    await tx.payment.deleteMany({ where: { brandId } });

    // 4) The account's MENU. Account-wide (it hangs off Brand, like the logo), so
    //    it's deleted here rather than per-branch.
    await tx.menuItem.deleteMany({ where: { brandId } });

    // 5) Finally the brand itself.
    await tx.brand.delete({ where: { id: brandId } });
  });
}
