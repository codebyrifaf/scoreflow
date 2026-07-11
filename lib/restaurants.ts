/**
 * Restaurant data access.
 *
 * A "restaurant" is a tenant of ScoreFlow, identified in URLs by its `slug`
 * (e.g. the "fucco" in /r/fucco/dashboard). Pages and the API resolve the slug
 * to a real restaurant here, on the server — this is the single source of truth
 * for "which restaurant is this request for?".
 */

import { prisma } from "./prisma";

/**
 * Look up a restaurant by its URL slug.
 *
 * Returns the restaurant, or `null` if no restaurant has that slug. Callers
 * decide what to do with `null` (pages call Next's `notFound()`; the API returns
 * a 404). `slug` is unique in the schema, so this matches at most one row.
 */
export async function getRestaurantBySlug(slug: string) {
  return prisma.restaurant.findUnique({ where: { slug } });
}

/**
 * List every restaurant for the operator admin dashboard (Milestone 6).
 *
 * Oldest first. For each restaurant we also pull the owner email(s) and a COUNT
 * of feedback rows (`_count.feedback`) — enough for the admin table without
 * loading every feedback row.
 */
export async function getAllRestaurantsForAdmin() {
  return prisma.restaurant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owners: { select: { email: true }, orderBy: { id: "asc" } },
      _count: { select: { feedback: true, tables: true } },
    },
  });
}

/**
 * Platform-wide totals for the operator's overview cards (Milestone 10):
 * how many restaurants, how many feedback responses in total, and the average
 * rating across ALL restaurants (null when there's no feedback yet).
 */
export async function getPlatformStats() {
  const [restaurantCount, agg] = await Promise.all([
    prisma.restaurant.count(),
    prisma.feedback.aggregate({
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  return {
    restaurantCount,
    responseCount: agg._count._all,
    avgRating: agg._avg.rating, // number | null
  };
}

/**
 * Create a new restaurant AND its owner login in one atomic step (Milestone 6).
 *
 * We run both inserts inside a `$transaction`, so if either fails, NEITHER is
 * written — you can never end up with a restaurant that has no owner, or an
 * owner pointing at a half-created restaurant.
 *
 * The password is passed in ALREADY HASHED (the caller hashes it with bcrypt),
 * so this data-access module never handles raw passwords. Uniqueness of `slug`
 * and the owner `email` is enforced by the database's unique constraints; the
 * caller also pre-checks them to show friendly error messages.
 */
export async function createRestaurantWithOwner(input: {
  name: string;
  slug: string;
  googleReviewUrl: string | null;
  reviewThreshold: number;
  ownerEmail: string;
  ownerPasswordHash: string;
}) {
  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        name: input.name,
        slug: input.slug,
        googleReviewUrl: input.googleReviewUrl,
        reviewThreshold: input.reviewThreshold,
      },
    });

    await tx.owner.create({
      data: {
        email: input.ownerEmail,
        passwordHash: input.ownerPasswordHash,
        restaurantId: restaurant.id,
      },
    });

    return restaurant;
  });
}

/**
 * Permanently delete a restaurant AND everything hanging off it (Milestone 11).
 *
 * ⚠️ Irreversible. The restaurant's foreign keys are `ON DELETE RESTRICT`, so the
 * database won't let us delete a restaurant that still has feedback / tables /
 * owners. We therefore delete the CHILDREN first, then the restaurant, all inside
 * a single `$transaction` — so it's all-or-nothing (a failure rolls everything
 * back; you can never end up half-deleted).
 *
 * Only the operator calls this, and only after a typed-slug confirmation in the
 * UI + a re-check in the server action (see app/admin/actions.ts).
 */
/**
 * Update a restaurant's editable fields (Milestone 12 — operator edit).
 * Only the restaurant's OWN config; owners/feedback/tables are untouched
 * (they're linked by `restaurantId`, so even changing the slug is data-safe —
 * it only changes the public URLs).
 */
export async function updateRestaurant(
  id: number,
  data: {
    name: string;
    slug: string;
    googleReviewUrl: string | null;
    reviewThreshold: number;
  }
) {
  return prisma.restaurant.update({ where: { id }, data });
}

export async function deleteRestaurantCascade(id: number) {
  return prisma.$transaction([
    prisma.feedback.deleteMany({ where: { restaurantId: id } }),
    prisma.table.deleteMany({ where: { restaurantId: id } }),
    prisma.owner.deleteMany({ where: { restaurantId: id } }),
    prisma.restaurant.delete({ where: { id } }),
  ]);
}
