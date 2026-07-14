"use server";

/**
 * "Forgot password" — step 2 (Milestone 20). Verify the emailed code and set a new
 * password. Works for brand owners and branch managers alike (both are `Owner`s).
 *
 * On success `updateOwnerPassword` bumps `tokenVersion`, so EVERY existing session
 * for that account dies (M17) — exactly what you want after "I forgot / I may have
 * been compromised".
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getOwnerByEmail, updateOwnerPassword } from "@/lib/owners";
import { validateNewPassword } from "@/lib/passwords";
import { verifyCode, issueCode } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { clientIpHash } from "@/lib/request-ip";
import { isThrottled, recordFailure } from "@/lib/login-attempts";

export type ResetState = { error: string } | undefined;

/**
 * Resend a password-reset code (Milestone 37) — the "Resend code" button on /reset.
 *
 * Works for both entry paths: the normal forgot-password flow AND a branch-manager
 * whose invite link lapsed (both use a "reset" code). Bound in the client with the
 * email.
 *
 * ⚠️ NO USER ENUMERATION. Like `requestReset`, this always does the same observable
 * thing (returns void, no error) whether or not the email has an account — it only
 * actually issues + emails a code when the account exists. Throttled by IP + email so
 * it can't be abused to spray reset emails.
 */
export async function resendResetCode(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const ipHash = clientIpHash(await headers());
  if (await isThrottled(normalized, ipHash)) return; // silently, no signal

  const owner = await getOwnerByEmail(normalized);
  if (owner) {
    const code = await issueCode(normalized, "reset");
    await sendEmail({
      to: normalized,
      subject: "Your ScoreFlow password reset code",
      body:
        `Here's your password reset code: ${code}\n\n` +
        `Enter it on the reset screen to choose a new password. It expires in 10 ` +
        `minutes.\n\n` +
        `If you didn't ask for this, you can ignore this email — your password stays ` +
        `the same.`,
    });
  }
  // Counts toward the throttle whether or not the email existed, so timing/behaviour
  // is identical either way.
  await recordFailure(normalized, ipHash);
}

export async function resetPassword(
  email: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const normalized = email.trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const weak = validateNewPassword(newPassword);
  if (weak) return { error: weak };
  if (newPassword !== confirmPassword) {
    return { error: "The passwords don't match." };
  }

  const result = await verifyCode(normalized, "reset", code);
  if (!result.ok) {
    const msg: Record<string, string> = {
      no_code: "That code has expired — request a new one.",
      expired: "That code has expired — request a new one.",
      too_many_attempts: "Too many wrong codes. Request a new one.",
      wrong: "That code isn't right. Check the email and try again.",
    };
    return { error: msg[result.reason] };
  }

  const owner = await getOwnerByEmail(normalized);
  if (!owner) {
    // A verified code implies the owner existed when it was issued; this only
    // trips on a delete mid-flow. Say nothing revealing.
    return { error: "Could not reset the password. Please start again." };
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updateOwnerPassword(owner.id, hash); // also revokes all sessions (M17)

  redirect(`/login?reset=1&email=${encodeURIComponent(normalized)}`);
}
