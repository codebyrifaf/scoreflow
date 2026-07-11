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
