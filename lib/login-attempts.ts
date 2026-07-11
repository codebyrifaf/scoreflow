/**
 * The login brute-force guard (Milestone 17).
 *
 * Before this, there was NO rate limit on login anywhere. An attacker could POST
 * `/api/auth/callback/credentials` in a loop — bypassing our login form entirely,
 * since Auth.js re-exports its handlers there — and guess passwords forever. With
 * a single, publicly-guessable operator account (`operator@scoreflow.test`), a
 * successful guess meant total platform compromise. Every guess also burned a
 * bcrypt compare, so it doubled as a free way to peg our CPU.
 *
 * This module records FAILED attempts and counts recent ones. `authorize()` in
 * auth.ts calls it BEFORE doing any bcrypt work (see the note there).
 *
 * ── Design notes ─────────────────────────────────────────────────────────────
 * • Only failures are stored. A successful login clears that email's rows, so a
 *   legitimate user who mistypes twice and then gets it right starts fresh.
 * • Lockouts AUTO-EXPIRE: we only ever count rows newer than the window, so a
 *   block lifts by itself. Nobody has to ask an admin to be unlocked.
 * • Two limits, deliberately different:
 *     - per IP    (tight)  → stops one attacker hammering us. The main defence.
 *     - per EMAIL (looser) → catches a distributed/botnet attack on one account.
 *   The email limit has a known trade-off: someone who knows an owner's email can
 *   deliberately fail logins to lock that owner out. That's why it's the LOOSER of
 *   the two and why the block is short and self-healing — a bounded annoyance is a
 *   fair price for stopping credential stuffing.
 * • We store a salted hash of the IP, never the raw address.
 */

import { prisma } from "./prisma";

/** How far back we look when counting failures. A block lasts at most this long. */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Failures from ONE IP within the window before we start refusing it. */
export const MAX_FAILURES_PER_IP = 20;

/** Failures against ONE email within the window before we start refusing it. */
export const MAX_FAILURES_PER_EMAIL = 10;

/** Failed-login rows older than this are junk; we delete them opportunistically. */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Is this login attempt currently throttled?
 *
 * Called BEFORE we verify the password, so a blocked caller costs us one indexed
 * count instead of a bcrypt hash. Returns true if EITHER limit is exceeded.
 */
export async function isThrottled(
  email: string,
  ipHash: string
): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const [byIp, byEmail] = await Promise.all([
    prisma.loginAttempt.count({ where: { ipHash, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { email, createdAt: { gte: since } } }),
  ]);

  return byIp >= MAX_FAILURES_PER_IP || byEmail >= MAX_FAILURES_PER_EMAIL;
}

/** Record one failed login. */
export async function recordFailure(
  email: string,
  ipHash: string
): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ipHash } });
}

/**
 * Wipe an email's failures after a SUCCESSFUL login — so honest users who fumbled
 * their password a few times don't carry a penalty around.
 *
 * Note we clear by email, not by IP: we don't want one successful login to also
 * reset an attacker's IP budget if they happen to share it.
 */
export async function clearFailures(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}

/**
 * Delete rows older than the prune window. Nothing outside the 15-minute lockout
 * window is ever read, so this table would otherwise grow forever. Called
 * best-effort (fire-and-forget) from the login path.
 */
export async function pruneOldAttempts(): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } },
  });
}
