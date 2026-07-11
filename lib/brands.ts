/**
 * Brand data access (Milestone 16 — multi-location chains).
 *
 * A Brand groups several branches (each branch is a `Restaurant`). Everything here
 * is the one place that reads/writes brands and rolls up per-branch stats for the
 * brand-owner console at /b/[brandSlug].
 */

import { prisma } from "./prisma";

/** Look up a brand by its URL slug (e.g. "kfc"), or null. */
export async function getBrandBySlug(slug: string) {
  return prisma.brand.findUnique({ where: { slug } });
}

/**
 * All brands for the operator admin: name, slug, brand-owner email(s), and each
 * branch (name/slug + its feedback & table counts). The operator manages a brand's
 * lifecycle here — the delete confirmation needs to spell out exactly what the
 * cascade will destroy, which is why we pull the branches and their counts.
 */
export async function getAllBrandsForAdmin() {
  return prisma.brand.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owners: { select: { email: true }, orderBy: { id: "asc" } },
      restaurants: {
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          slug: true,
          _count: { select: { feedback: true, tables: true } },
        },
      },
    },
  });
}

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
    googleReviewUrl: b.googleReviewUrl ?? "",
    reviewThreshold: b.reviewThreshold,
    responses: b._count.feedback,
    tables: b._count.tables,
    managerEmails: b.owners.map((o) => o.email),
    avgRating: avgById.get(b.id) ?? null,
  }));
}

/**
 * Create a Brand + its brand-owner login in one transaction (operator action).
 * The brand owner is brand-scoped (`brandId` set, `restaurantId` null).
 */
export async function createBrandWithOwner(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPasswordHash: string;
}) {
  return prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: { name: input.name, slug: input.slug },
    });
    await tx.owner.create({
      data: {
        email: input.ownerEmail,
        passwordHash: input.ownerPasswordHash,
        brandId: brand.id,
        // NOTIFICATION DEFAULTS (M18) — the inverse of a branch manager's.
        // A brand owner oversees several branches, so instant alerts from all of
        // them would mean a flood of email every day; they'd mute it and then see
        // nothing. They get ONE daily digest instead, and can opt into instant
        // alerts from their settings if they want them.
        alertsEnabled: false,
        digestEnabled: true,
      },
    });
    return brand;
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
    await tx.owner.deleteMany({ where: { restaurantId: { in: branchIds } } }); // branch managers

    // 2) The branches themselves, then the brand-owner login(s), then the brand.
    await tx.restaurant.deleteMany({ where: { brandId } });
    await tx.owner.deleteMany({ where: { brandId } });
    await tx.brand.delete({ where: { id: brandId } });
  });
}
