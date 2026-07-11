"use server";

/**
 * Owner account actions (Milestone 12). Right now: change your own password.
 *
 * The operator gives an owner an email + initial password; the owner controls
 * their own password from here. This is scoped to the LOGGED-IN owner — we read
 * who they are from the session, never from the client — so an owner can only
 * ever change their own password.
 */

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getOwnerByEmail, updateOwnerPassword } from "@/lib/owners";

export type ChangePasswordState = { error: string } | { ok: true } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  // Must be signed in as an OWNER (operators have no restaurant password to change).
  const session = await auth();
  const email = session?.user?.email;
  if (!email || session?.user?.role !== "owner") {
    return { error: "You must be signed in as a restaurant owner." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Please fill in all three fields." };
  }
  if (newPassword.length < 8) {
    return { error: "Your new password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The new passwords don't match." };
  }

  const owner = await getOwnerByEmail(email.trim().toLowerCase());
  if (!owner) {
    return { error: "Account not found." };
  }

  // Verify the CURRENT password before allowing a change.
  const ok = await bcrypt.compare(currentPassword, owner.passwordHash);
  if (!ok) {
    return { error: "Your current password is incorrect." };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await updateOwnerPassword(owner.id, newHash);

  return { ok: true };
}
