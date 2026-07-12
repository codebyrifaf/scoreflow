"use server";

/**
 * Self-serve signup (Milestone 20) — the SaaS front door.
 *
 * Two steps, on purpose:
 *   1. `requestSignup` — validate, stash a PENDING signup (nothing real is created
 *      yet), and email a 6-digit code.
 *   2. `confirmSignup` — check the code, and only THEN create the real account
 *      (Brand + owner + one restaurant) on a 14-day trial.
 *
 * Why not create the account immediately? Because signup is public and
 * unauthenticated. Creating an Owner/Brand/Restaurant before the email is proven
 * would let anyone squat slugs and emails, and blast OTPs to strangers. Holding an
 * unverified signup in `PendingSignup` keeps junk out of the real tables.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getOwnerByEmail } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";
import { createAccountFromSignup } from "@/lib/brands";
import { validateNewPassword } from "@/lib/passwords";
import { sendEmail } from "@/lib/email";
import { clientIpHash } from "@/lib/request-ip";
import { isThrottled, recordFailure, clearFailures } from "@/lib/login-attempts";
import { issueCode, verifyCode, pruneExpiredCodes } from "@/lib/verification";

const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignupState =
  | { errors: Record<string, string> }
  | undefined;

/** Send (or re-send) the verification email. */
async function emailCode(email: string) {
  const code = await issueCode(email, "signup");
  await sendEmail({
    to: email,
    subject: "Your ScoreFlow verification code",
    body:
      `Welcome to ScoreFlow!\n\n` +
      `Your verification code is: ${code}\n\n` +
      `Enter it on the signup screen to finish creating your account. ` +
      `It expires in 10 minutes.\n\n` +
      `If you didn't request this, you can ignore this email.`,
  });
}

/**
 * Step 1: take the details, email a code, go to the verify screen. Nothing is
 * created in the real tables yet.
 */
export async function requestSignup(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const restaurantName = String(formData.get("restaurantName") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!restaurantName) errors.restaurantName = "Restaurant name is required.";
  const weak = validateNewPassword(password);
  if (weak) errors.password = weak;

  if (Object.keys(errors).length > 0) return { errors };

  // Rate-limit by IP so nobody can hammer this to blast OTP emails from our Gmail
  // (reuses the hardened login-attempt guard).
  const ipHash = clientIpHash(await headers());
  if (await isThrottled(email, ipHash)) {
    return { errors: { form: "Too many attempts. Please try again in a few minutes." } };
  }

  // ── No user enumeration (M25) ──────────────────────────────────────────────
  // If the email already has an account, we must NOT say so on the response —
  // that would let an attacker probe which emails (including the operator's) are
  // registered. Instead we behave EXACTLY as we do for a new email: we always
  // redirect to the verify screen. The difference is invisible from outside:
  //   • new email  → we create a pending signup + email a verification CODE;
  //   • existing   → we create nothing, and email the real owner a heads-up that
  //                  someone tried to sign up with their address (with a nudge to
  //                  sign in / reset). No code exists, so the verify step just
  //                  fails like a wrong code — revealing nothing.
  const existing =
    (await getOwnerByEmail(email)) || (await getOperatorByEmail(email));

  // Always pay the bcrypt cost, even for an existing email — otherwise the
  // existing path (no hashing) returns measurably faster and RESPONSE TIMING
  // becomes an enumeration oracle. Hashing here keeps both paths ~constant-time.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    if (existing) {
      await sendEmail({
        to: email,
        subject: "You already have a ScoreFlow account",
        body:
          `Someone tried to start a new ScoreFlow signup with this email, but you ` +
          `already have an account.\n\n` +
          `If that was you, just sign in — or use "Forgot password" if you can't ` +
          `remember it. If it wasn't you, you can safely ignore this email; nothing ` +
          `has changed.`,
      });
    } else {
      // Upsert: re-submitting the same email just refreshes the pending row + code.
      await prisma.pendingSignup.upsert({
        where: { email },
        update: { passwordHash, restaurantName },
        create: { email, passwordHash, restaurantName },
      });
      await emailCode(email);
    }
    await recordFailure(email, ipHash); // counts toward the IP throttle either way
  } catch {
    return { errors: { form: "Could not start signup. Please try again." } };
  }

  // Same destination whether the email existed or not — no enumeration.
  // (redirect throws — must be outside try/catch.)
  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

/** Re-send the code (bound with the email in the client). */
export async function resendSignupCode(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.pendingSignup.findUnique({ where: { email: normalized } });
  if (!pending) return; // nothing to resend
  const ipHash = clientIpHash(await headers());
  if (await isThrottled(normalized, ipHash)) return;
  await emailCode(normalized);
  await recordFailure(normalized, ipHash);
}

export type VerifyState = { error: string } | undefined;

/**
 * Step 2: verify the code and CREATE the real account. Bound in the client as
 * `confirmSignup.bind(null, email)`.
 */
export async function confirmSignup(
  email: string,
  _prev: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const normalized = email.trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyCode(normalized, "signup", code);
  if (!result.ok) {
    const msg: Record<string, string> = {
      no_code: "That code has expired — please start again.",
      expired: "That code has expired — request a new one.",
      too_many_attempts: "Too many wrong codes. Request a new one.",
      wrong: "That code isn't right. Check the email and try again.",
    };
    return { error: msg[result.reason] };
  }

  const pending = await prisma.pendingSignup.findUnique({ where: { email: normalized } });
  if (!pending) {
    return { error: "We couldn't find your signup — please start again." };
  }

  // Last-moment guard against a race where the email got taken between steps.
  if ((await getOwnerByEmail(normalized)) || (await getOperatorByEmail(normalized))) {
    await prisma.pendingSignup.delete({ where: { email: normalized } }).catch(() => {});
    return { error: "That email already has an account. Please sign in." };
  }

  try {
    await createAccountFromSignup({
      ownerEmail: normalized,
      ownerPasswordHash: pending.passwordHash,
      restaurantName: pending.restaurantName,
    });
    await prisma.pendingSignup.delete({ where: { email: normalized } });
    await clearFailures(normalized);
    await pruneExpiredCodes();
  } catch {
    return { error: "Could not create your account. Please try again." };
  }

  // Account created + trial started. Send them to sign in (we don't hold the
  // plaintext password, so we can't auto-login — and re-authenticating cleanly
  // exercises the real login + subscription gate).
  redirect(`/login?verified=1&email=${encodeURIComponent(normalized)}`);
}
