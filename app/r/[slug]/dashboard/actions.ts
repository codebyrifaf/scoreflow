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

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getOwnerById, updateOwnerPassword } from "@/lib/owners";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { resolveFeedback as resolveFeedbackRow } from "@/lib/feedback";
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

/** What the "Mark resolved" button reads back. */
export type ResolveState = { error: string } | { ok: true } | undefined;

/**
 * Mark one unhappy diner as dealt with (Milestone 18) — the "Needs attention"
 * worklist. Bound in the client as `markResolved.bind(null, slug, feedbackId)`.
 *
 * ⚠️ SECURITY — this is the first action in the app that takes a ROW ID from the
 * browser, so it's genuinely new attack surface. Two independent defences:
 *
 *   1. `requireDashboardAccess(slug)` — are you allowed to touch this restaurant
 *      at all? (Re-reads the DB; branch manager → own branch, brand owner → their
 *      brand's branches, everyone else out.)
 *   2. The write itself is SCOPED: `resolveFeedbackRow` does
 *      `updateMany({ where: { id, restaurantId } })`. So even a caller who is a
 *      legitimate owner of restaurant A, forging a feedback id belonging to
 *      restaurant B, matches ZERO rows and changes nothing.
 *
 * Check (1) alone is not enough — it would happily let the owner of A resolve B's
 * feedback if the id were guessed. It's the pairing that closes it, the same way
 * `deleteTable` (lib/tables.ts) is written.
 */
export async function markResolved(
  slug: string,
  feedbackId: number,
  _prevState: ResolveState,
  _formData: FormData
): Promise<ResolveState> {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return { error: "Restaurant not found." };
  }

  if (!Number.isInteger(feedbackId)) {
    return { error: "Invalid feedback." };
  }

  // Scoped write — an id from another restaurant simply matches nothing.
  const updated = await resolveFeedbackRow(
    feedbackId,
    restaurant.id,
    access.ownerEmail
  );
  if (updated === 0) {
    return { error: "That feedback is no longer open." };
  }

  revalidatePath(`/r/${slug}/dashboard`);
  return { ok: true };
}
