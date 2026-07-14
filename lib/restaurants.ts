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
 * The restaurant PLUS its brand's logo (Milestone 26) — for the diner-facing
 * feedback page, which brands itself with the account's logo. We pull the logo
 * ONLY here (not in the lean `getRestaurantBySlug` that the rest of the app uses),
 * so the (potentially chunky) data-URL blob isn't dragged into every restaurant
 * lookup.
 */
export async function getRestaurantForFeedback(slug: string) {
  return prisma.restaurant.findUnique({
    where: { slug },
    include: { brand: { select: { logoDataUrl: true } } },
  });
}

// NOTE (M22): `getAllRestaurantsForAdmin()` and `getPlatformStats()` lived here to
// feed the old `/admin` area, where the operator created and edited every account
// by hand. That whole area has been RETIRED — restaurants now sign themselves up,
// change their own settings, reset their own passwords, and close their own
// accounts. The operator's console is sales-only (see lib/operator-stats.ts), so
// these functions had no callers left and were removed rather than left to rot.

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
  positiveThreshold: number;
  ownerEmail: string;
  ownerPasswordHash: string;
  /** When set, this restaurant is a BRANCH of that brand (Milestone 16). */
  brandId?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        name: input.name,
        slug: input.slug,
        googleReviewUrl: input.googleReviewUrl,
        positiveThreshold: input.positiveThreshold,
        brandId: input.brandId ?? null,
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
 * Update a branch's editable IDENTITY fields, from the brand console (Milestone 12;
 * M35 removed review links from here). Only the branch's own name / slug / threshold —
 * owners, feedback and tables are untouched (linked by `restaurantId`, so even a slug
 * change is data-safe; it only re-points the public URLs).
 *
 * ⚠️ It deliberately does NOT touch review links. Those are set in the branch's own
 * Settings (via `updateRestaurantSettings`), by whoever runs the branch — exactly like
 * a solo restaurant. Listing the fields explicitly here means a review link can never
 * be blanked by a brand-console edit.
 */
export async function updateRestaurant(
  id: number,
  data: {
    name: string;
    slug: string;
    positiveThreshold: number;
    alertThreshold?: number;
  }
) {
  return prisma.restaurant.update({ where: { id }, data });
}

/**
 * The OWNER-SAFE settings update (Milestone 18) — what a restaurant owner may
 * change about their own venue, without an operator.
 *
 * ⚠️ Why this exists instead of just reusing `updateRestaurant`: that function can
 * change the **slug**, and an owner must never be able to. The slug is baked into
 * the NFC chips physically stuck to their tables (`/r/<slug>/feedback`), so
 * renaming it would silently brick every chip in the restaurant and the owner
 * would have no idea why feedback stopped arriving. Slug changes stay with the
 * operator, who knows to re-program the chips.
 *
 * By listing the allowed fields explicitly, a stray extra field in a form post can
 * never reach the database either.
 */
export async function updateRestaurantSettings(
  id: number,
  data: {
    name: string;
    googleReviewUrl: string | null;
    /** The other review platforms (M29). Null clears the link → tile disappears. */
    tripadvisorUrl: string | null;
    yelpUrl: string | null;
    zomatoUrl: string | null;
    positiveThreshold: number;
    alertThreshold: number;
  }
) {
  return prisma.restaurant.update({
    where: { id },
    // Every field is listed EXPLICITLY — that's the point of this function. A stray
    // extra field in a form post can never reach the database, and `slug` in
    // particular can never be written here (see the note above).
    data: {
      name: data.name,
      googleReviewUrl: data.googleReviewUrl,
      tripadvisorUrl: data.tripadvisorUrl,
      yelpUrl: data.yelpUrl,
      zomatoUrl: data.zomatoUrl,
      positiveThreshold: data.positiveThreshold,
      alertThreshold: data.alertThreshold,
    },
  });
}

/**
 * Operator switches a review-link platform OFF / back ON for one restaurant (M39).
 *
 * Blocking keeps the URL but hides that platform's tile from diners (see
 * `activeReviewLinks`). Used by the operator's per-customer links view to kill a
 * wrong/bad link (e.g. a valid Yelp URL that points at the wrong business). The M29
 * allowlist already blocks phishing, so this only ever catches "real link, wrong page".
 * Idempotent: blocking an already-blocked platform is a no-op.
 */
export async function blockReviewLink(restaurantId: number, platform: string) {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { blockedReviewPlatforms: true },
  });
  if (!r || r.blockedReviewPlatforms.includes(platform)) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { blockedReviewPlatforms: { set: [...r.blockedReviewPlatforms, platform] } },
  });
}

export async function unblockReviewLink(restaurantId: number, platform: string) {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { blockedReviewPlatforms: true },
  });
  if (!r) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      blockedReviewPlatforms: {
        set: r.blockedReviewPlatforms.filter((p) => p !== platform),
      },
    },
  });
}

export async function deleteRestaurantCascade(id: number) {
  return prisma.$transaction([
    prisma.feedback.deleteMany({ where: { restaurantId: id } }),
    prisma.table.deleteMany({ where: { restaurantId: id } }),
    prisma.owner.deleteMany({ where: { restaurantId: id } }),
    prisma.restaurant.delete({ where: { id } }),
  ]);
}
