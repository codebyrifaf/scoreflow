/**
 * Restaurant data access.
 *
 * A "restaurant" is a tenant of ScoreFlow, identified in URLs by its `slug`
 * (e.g. the "fucco" in /r/fucco/dashboard). Pages and the API resolve the slug
 * to a real restaurant here, on the server — this is the single source of truth
 * for "which restaurant is this request for?".
 */

import { prisma } from "./prisma";
import { slugify } from "./slug";

/**
 * A slug derived from `name` and guaranteed not to collide with an existing
 * restaurant. If "cafe" is taken it tries "cafe-2", "cafe-3", … The database's unique
 * constraint is still the real backstop; this just avoids an ugly error in the common
 * case.
 *
 * Lives here rather than in lib/slug.ts because it queries the Restaurant table —
 * and because keeping lib/slug.ts free of Prisma is what lets the add-location form
 * (a client component) import `slugify` to preview the URL as the owner types.
 */
export async function uniqueRestaurantSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // Bounded loop — in practice resolves on the first or second try.
  while (await prisma.restaurant.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`.slice(0, 40);
  }
  return candidate;
}

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
 * Create one LOCATION under an account, optionally with its own manager login.
 *
 * This is now the ONLY way a restaurant comes into existence. Signup creates the
 * account (Brand + Owner) and nothing else, so the first location and the tenth are
 * born here, identically — which is the whole point of the change. It replaces the
 * old `createRestaurantWithOwner`, whose name encoded the assumption this fixes:
 * that a restaurant ALWAYS has its own owner row.
 *
 * ── `manager` is optional, and that's the feature ────────────────────────────
 *   • `manager` given → a branch-manager `Owner` scoped to this one restaurant.
 *     The password arrives ALREADY HASHED, so this module never handles a raw one.
 *     (The caller creates it as a random, unusable hash and emails an invite — we
 *     never mail anybody a password. See `addBranch`.)
 *   • `manager` omitted/null → NO owner row. The ACCOUNT OWNER runs this location
 *     directly, which the M16 guard already permits (a brand owner is authorised on
 *     any branch of their brand). A manager can be attached later without recreating
 *     the branch — see `inviteBranchManager`.
 *
 * Both inserts share one `$transaction`, so a failure writes neither: you can never
 * end up with a manager login pointing at a half-created restaurant.
 *
 * Uniqueness of `slug` and the manager `email` is enforced by the database's unique
 * constraints; the caller pre-checks both to show a friendly error instead.
 *
 * ⚠️ Review links are deliberately NOT settable here (M35). All four platforms are
 * configured in the branch's own Settings, by whoever runs it.
 */
export async function createBranch(input: {
  brandId: number;
  name: string;
  slug: string;
  /** Defaults to the schema's 8 — it's tuned later in the branch's Settings. */
  positiveThreshold?: number;
  manager?: { email: string; passwordHash: string } | null;
}) {
  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        name: input.name,
        slug: input.slug,
        brandId: input.brandId,
        ...(input.positiveThreshold !== undefined
          ? { positiveThreshold: input.positiveThreshold }
          : {}),
      },
    });

    if (input.manager) {
      await tx.owner.create({
        data: {
          email: input.manager.email,
          passwordHash: input.manager.passwordHash,
          restaurantId: restaurant.id,
        },
      });
    }

    return restaurant;
  });
}

/**
 * Does this branch already have a manager login of its own? (`false` = the account
 * owner runs it directly.) Used to decide between "Invite manager" and "Reset
 * password" on a branch card, and to refuse a second invite.
 */
export async function branchHasManager(restaurantId: number): Promise<boolean> {
  const n = await prisma.owner.count({ where: { restaurantId } });
  return n > 0;
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
    // Orders this location's till pushed. Its FK is ON DELETE RESTRICT like every
    // other one here, so omitting it would make deleting any connected location
    // fail — the same trap `Payment` sprang on `deleteBrandCascade` in M21.
    // (The MENU is NOT deleted here: it belongs to the account, not the location,
    // and the account's other locations are still using it.)
    prisma.posOrder.deleteMany({ where: { restaurantId: id } }),
    prisma.owner.deleteMany({ where: { restaurantId: id } }),
    prisma.restaurant.delete({ where: { id } }),
  ]);
}
