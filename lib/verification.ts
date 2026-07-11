/**
 * One-time verification codes (Milestone 20) — used for BOTH confirming a new
 * signup's email and for "forgot password" resets.
 *
 * Security shape:
 *   • The 6-digit code is stored HASHED (sha256). A database leak can't reveal a
 *     live code, so it can't be used to hijack a signup or seize an account.
 *   • Codes EXPIRE (10 min) and are ATTEMPT-CAPPED (5 wrong guesses burns it), so a
 *     6-digit code can't be brute-forced — 5 tries against 1,000,000 possibilities.
 *   • Requesting a new code for an email REPLACES the old one, so only the latest
 *     code for a given purpose is ever valid.
 *
 * (Sending the code is a separate concern — callers hand the plaintext code to
 * lib/email.ts. This module never sends anything.)
 */

import { createHash, randomInt } from "node:crypto";
import { prisma } from "./prisma";

export type VerificationPurpose = "signup" | "reset";

/** How long a code is valid. Short on purpose — it's a friction-vs-safety balance. */
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Wrong guesses before a code is dead and the user must request a new one. */
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** A cryptographically-random 6-digit code, e.g. "042915". Zero-padded. */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Issue a fresh code for `email` + `purpose`, and return the PLAINTEXT so the
 * caller can email it. Any previous code for the same email+purpose is deleted
 * first, so only the newest one works.
 */
export async function issueCode(
  email: string,
  purpose: VerificationPurpose
): Promise<string> {
  const code = generateCode();
  await prisma.$transaction([
    prisma.verificationCode.deleteMany({ where: { email, purpose } }),
    prisma.verificationCode.create({
      data: {
        email,
        purpose,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);
  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "wrong" };

/**
 * Check a code the user typed. On success the code is CONSUMED (deleted) so it
 * can't be replayed. On a wrong guess we increment `attempts` and burn the code
 * once the cap is hit. Never reveals which specific thing was wrong beyond the
 * coarse reason (callers show a single friendly message).
 */
export async function verifyCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<VerifyResult> {
  const row = await prisma.verificationCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!row) return { ok: false, reason: "no_code" };

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.verificationCode.delete({ where: { id: row.id } });
    return { ok: false, reason: "expired" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.verificationCode.delete({ where: { id: row.id } });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (row.codeHash !== hashCode(code)) {
    await prisma.verificationCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "wrong" };
  }

  // Correct — consume it so it can never be used again.
  await prisma.verificationCode.delete({ where: { id: row.id } });
  return { ok: true };
}

/** Best-effort cleanup of expired codes. Called opportunistically from the flow. */
export async function pruneExpiredCodes(): Promise<void> {
  await prisma.verificationCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
