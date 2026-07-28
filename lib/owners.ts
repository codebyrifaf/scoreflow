/**
 * Owner data access — the one place that reads owner (login account) rows.
 *
 * An "owner" is a restaurant's login account (see the `Owner` model in
 * prisma/schema.prisma). This file is the single source of truth for "who is
 * this owner, and which restaurant do they own?". Auth uses it to verify a
 * login; the login redirect uses it to find the owner's dashboard.
 */

import { prisma } from "./prisma";

/**
 * Look up an owner by email, INCLUDING the restaurant they own.
 *
 * Returns the owner (with a `.restaurant`) or `null` if no account has that
 * email. Callers decide what to do with `null` (auth treats it as a failed
 * login). `email` is unique in the schema, so this matches at most one row.
 *
 * Note: we always look up by the exact stored email. Callers should normalise
 * the address (trim + lowercase) BEFORE calling, so "Owner@Fucco.test" and
 * "owner@fucco.test" resolve to the same account.
 */
export async function getOwnerByEmail(email: string) {
  return prisma.owner.findUnique({
    where: { email },
    // Include BOTH scopes: `restaurant` (branch managers) and `brand` (brand
    // owners). Exactly one is set — auth.ts derives the role from which it is.
    include: { restaurant: true, brand: true },
  });
}

/**
 * Update ONE owner's password hash (Milestone 12 — owner changes their own
 * password). Scoped to a single owner id; the caller resolves the owner from the
 * session and verifies the current password first (see the dashboard action).
 */
/**
 * Look up an owner by their numeric id, INCLUDING their restaurant and brand.
 *
 * This is what the guards call on every protected request (Milestone 17). The
 * session cookie tells us *who* the visitor claims to be (an id); this function
 * fetches what they are actually allowed to see, live from the database. See the
 * long note in lib/auth-guard.ts for why authority must not live in the token.
 */
export async function getOwnerById(id: number) {
  return prisma.owner.findUnique({
    where: { id },
    include: { restaurant: true, brand: true },
  });
}

/**
 * Create a BRANCH MANAGER login for one location.
 *
 * Used when a manager is attached to a branch that already exists — i.e. an owner who
 * chose "I'll run it myself" when adding the location has now decided to hand it to
 * someone. (When the manager is named at creation time, `createBranch` writes both
 * rows in one transaction instead.)
 *
 * The password arrives ALREADY HASHED, and the caller passes a random, UNUSABLE hash:
 * the account can't be signed into until the manager follows an emailed invite and
 * sets their own password. We never mail anybody a password (M36).
 *
 * ⚠️ This does NOT affect the account owner's access. A brand owner is authorised on
 * `brandId`, independently of who manages a branch — adding a manager adds a person,
 * it never removes the owner. See lib/auth-guard.ts.
 */
export async function createBranchManager(input: {
  restaurantId: number;
  email: string;
  passwordHash: string;
}) {
  return prisma.owner.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      restaurantId: input.restaurantId,
    },
  });
}

/**
 * Everyone who should be told when a diner is unhappy at this restaurant
 * (Milestone 18).
 *
 * Two groups, deliberately treated differently:
 *   • the restaurant's own BRANCH MANAGERS → instant, if they have alerts on. They
 *     can walk over and fix it tonight.
 *   • the BRAND OWNER above it → only if they explicitly opted INTO instant alerts.
 *     By default they get a daily digest instead, because a four-branch owner
 *     receiving twenty instant emails a day would simply mute everything and then
 *     see nothing at all.
 */
export async function getAlertRecipientsForRestaurant(restaurantId: number) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { brandId: true },
  });

  return prisma.owner.findMany({
    where: {
      alertsEnabled: true,
      OR: [
        { restaurantId }, // the branch's own manager(s)
        // the brand owner above it — but only if they asked for instant alerts
        ...(restaurant?.brandId ? [{ brandId: restaurant.brandId }] : []),
      ],
    },
    select: { id: true, email: true },
  });
}

/**
 * Everyone who wants the daily digest (Milestone 18) — brand owners AND branch
 * managers.
 *
 * Brand owners get it by default (one email covering all their branches). A branch
 * manager can turn it on too, and for them it also acts as the SAFETY NET: instant
 * alerts are batched with a cooldown, so during a burst some complaints are held
 * back rather than firing an email each. The digest sweeps up anything the instant
 * alerts didn't cover, so nothing can quietly go unreported.
 */
export async function getDigestRecipients() {
  return prisma.owner.findMany({
    where: { digestEnabled: true },
    select: { id: true, email: true, brandId: true, restaurantId: true },
  });
}

/**
 * Update ONE owner's notification preferences (Milestone 18).
 * Scoped to a single owner id, which the caller reads from the signed session —
 * so nobody can change someone else's notification settings.
 */
export async function updateNotificationPrefs(
  id: number,
  prefs: { alertsEnabled: boolean; digestEnabled: boolean }
) {
  return prisma.owner.update({ where: { id }, data: prefs });
}

/**
 * Change ONE owner's password AND invalidate all of their existing sessions
 * (Milestone 17), atomically.
 *
 * Bumping `tokenVersion` is what makes a password reset actually mean something.
 * Sessions are stateless JWTs — there is no sessions table to delete from — so
 * before M17, resetting a fired manager's password changed nothing: their browser
 * kept working for up to 30 days. Now every guard compares the token's
 * `tokenVersion` against this column, so the moment it moves, every session that
 * person has, on every device, is dead.
 *
 * Replaces the old `updateOwnerPassword` — a password change should NEVER leave
 * old sessions alive, so the two are deliberately welded together in one call.
 */
export async function updateOwnerPassword(id: number, passwordHash: string) {
  return prisma.owner.update({
    where: { id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}
