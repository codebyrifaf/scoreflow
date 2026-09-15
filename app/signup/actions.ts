"use server";

/**
 * Self-serve signup (Milestone 20) — the SaaS front door.
 *
 * Two steps, on purpose:
 *   1. `requestSignup` — validate, stash a PENDING signup (nothing real is created
 *      yet), and email a 6-digit code.
 *   2. `confirmSignup` — check the code, and only THEN create the real account
 *      (Brand + owner) on a 14-day trial.
 *
 * ⚠️ Signup creates the ACCOUNT, not a restaurant. It used to also spin up one
 * `Restaurant` from the same name, which made the first location unlike every later
 * one (no manager, different code path, name shared with the company). The customer
 * now adds their location(s) afterwards — see `createAccountFromSignup`.
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
import { sendEmail, type EmailResult } from "@/lib/email";
import { clientIpHash } from "@/lib/request-ip";
import { isThrottled, recordFailure, clearFailures } from "@/lib/login-attempts";
import { issueCode, verifyCode, pruneExpiredCodes } from "@/lib/verification";

const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignupState =
  | { errors: Record<string, string> }
  | undefined;

/** Said whenever the email didn't actually leave — on every path, word for word. */
const SEND_FAILED =
  "We couldn't send your verification email just now. Please try again in a few minutes.";

/** Send (or re-send) the verification email. "failed" means it never left. */
async function emailCode(email: string): Promise<EmailResult> {
  const code = await issueCode(email, "signup");
  return sendEmail({
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
  // The ACCOUNT's name (the company), not a venue — locations are added later.
  const businessName = String(formData.get("businessName") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!businessName) errors.businessName = "Please enter your business name.";
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

  let sent: EmailResult;
  try {
    if (existing) {
      sent = await sendEmail({
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
        update: { passwordHash, businessName },
        create: { email, passwordHash, businessName },
      });
      sent = await emailCode(email);
      // No email, no half-started signup left behind.
      if (sent === "failed") await prisma.pendingSignup.delete({ where: { email } }).catch(() => {});
    }
    await recordFailure(email, ipHash); // counts toward the IP throttle either way
  } catch {
    return { errors: { form: "Could not start signup. Please try again." } };
  }

  // ⚠️ The email must actually have LEFT. `sendEmail` never throws (a failed alert
  // mustn't break whatever triggered it), and this used to ignore its answer — so
  // when the Gmail app password was revoked, a new owner was told "We sent a 6-digit
  // code" for a code that never went, and waited for nothing. The SAME message on
  // both paths, so an email outage can't reveal which addresses have accounts (M25).
  // ("logged" — no provider set up, in development — still goes on: the code is in
  // the terminal.)
  if (sent === "failed") return { errors: { form: SEND_FAILED } };

  // Same destination whether the email existed or not — no enumeration.
  // (redirect throws — must be outside try/catch.)
  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

export type ResendState = { ok: true } | { error: string };

/**
 * Re-send the code (bound with the email in the client).
 *
 * "Nothing to resend" and "throttled" still answer like a success, as before — saying
 * otherwise would tell a stranger whether a signup is waiting for an address. Only a
 * send that genuinely FAILED is reported: the Resend link used to say "Sent!" then too.
 */
export async function resendSignupCode(email: string): Promise<ResendState> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.pendingSignup.findUnique({ where: { email: normalized } });
  if (!pending) return { ok: true }; // nothing to resend
  const ipHash = clientIpHash(await headers());
  if (await isThrottled(normalized, ipHash)) return { ok: true };
  const sent = await emailCode(normalized);
  await recordFailure(normalized, ipHash);
  return sent === "failed" ? { error: SEND_FAILED } : { ok: true };
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
      businessName: pending.businessName,
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
