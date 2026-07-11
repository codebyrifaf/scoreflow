"use server";

/**
 * "Close my account" (Milestone 22) — the customer's own exit door.
 *
 * The operator no longer manages accounts, so the owner must be able to leave on
 * their own terms and take their data with them (i.e. have it destroyed). This
 * deletes EVERYTHING: every location, every diner's feedback, every table, every
 * branch-manager login, the payment ledger, and the account itself.
 *
 * SECURITY / SAFETY:
 *   • `requireAccountOwner()` — a BRANCH MANAGER cannot do this. They run one
 *     location; they must never be able to delete their employer's whole company.
 *   • It is NOT subscription-gated, so a customer whose trial lapsed can still
 *     leave. Being locked out of the product AND unable to leave would be a trap.
 *   • The owner must type the account name exactly — the same typed confirmation
 *     used everywhere else something irreversible happens.
 */

import { redirect } from "next/navigation";
import { requireAccountOwner } from "@/lib/auth-guard";
import { deleteBrandCascade } from "@/lib/brands";
import { signOut } from "@/auth";

export type CloseState = { error: string } | undefined;

export async function closeAccount(
  _prev: CloseState,
  formData: FormData
): Promise<CloseState> {
  const access = await requireAccountOwner();
  if (!access.authorized) {
    return { error: "Only the account owner can close the account." };
  }

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== access.brandName) {
    return { error: `Type “${access.brandName}” exactly to confirm.` };
  }

  try {
    // Removes locations, feedback, tables, manager logins, payments, and the
    // account itself — in one transaction.
    await deleteBrandCascade(access.brandId);
  } catch {
    return { error: "Could not close the account. Please try again." };
  }

  // Their Owner row is gone, so the session is already dead (the guards re-read the
  // database on every request — M17). Clear the cookie and send them to the front
  // page. signOut throws a redirect, so it must be the last thing we do.
  await signOut({ redirectTo: "/" });
}
