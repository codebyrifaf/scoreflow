"use server";

/**
 * Owner account actions (Milestone 12; hardened in M17). Right now: change your
 * own password.
 *
 * The operator gives an owner an email + initial password; the owner controls
 * their own password from here. This is scoped to the LOGGED-IN account — we read
 * who they are from the session, never from the client — so an owner can only
 * ever change their own password.
 *
 * M17 changes:
 *  • BRAND OWNERS can use this too. The check used to be `role !== "owner"`, but a
 *    brand owner's role is "brand" — so the Change-password modal on /b/<slug> was
 *    rendered for them and then ALWAYS failed. Since changing a password is the
 *    lever that revokes sessions, leaving it broken for chain customers made no
 *    sense.
 *  • We look the account up by its numeric id from the session, not by email.
 *  • Minimum length is now 12 (was 8).
 *  • `updateOwnerPassword` now also bumps `tokenVersion`, which SIGNS THE USER OUT
 *    EVERYWHERE, including on this device. That's intended: "change my password"
 *    must actually eject anyone who stole the old one. The modal tells them so and
 *    sends them back to sign in.
 */

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getOwnerById, updateOwnerPassword } from "@/lib/owners";
import { validateNewPassword } from "@/lib/passwords";

export type ChangePasswordState = { error: string } | { ok: true } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  // Must be signed in as an OWNER account — either a branch manager ("owner") or a
  // brand owner ("brand"). Operators live in a different table and have no
  // restaurant password to change here.
  const session = await auth();
  const user = session?.user;
  if (!user?.accountId || user.kind !== "owner") {
    return { error: "You must be signed in as a restaurant or brand owner." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Please fill in all three fields." };
  }
  const weak = validateNewPassword(newPassword);
  if (weak) {
    return { error: weak };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The new passwords don't match." };
  }

  const owner = await getOwnerById(user.accountId);
  if (!owner) {
    return { error: "Account not found." };
  }

  // Verify the CURRENT password before allowing a change.
  const ok = await bcrypt.compare(currentPassword, owner.passwordHash);
  if (!ok) {
    return { error: "Your current password is incorrect." };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  // Also bumps tokenVersion → every existing session for this account dies,
  // on every device (including this one).
  await updateOwnerPassword(owner.id, newHash);

  return { ok: true };
}
