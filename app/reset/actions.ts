"use server";

/**
 * "Forgot password" — step 2 (Milestone 20). Verify the emailed code and set a new
 * password. Works for brand owners and branch managers alike (both are `Owner`s).
 *
 * On success `updateOwnerPassword` bumps `tokenVersion`, so EVERY existing session
 * for that account dies (M17) — exactly what you want after "I forgot / I may have
 * been compromised".
 */

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getOwnerByEmail, updateOwnerPassword } from "@/lib/owners";
import { validateNewPassword } from "@/lib/passwords";
import { verifyCode } from "@/lib/verification";

export type ResetState = { error: string } | undefined;

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
