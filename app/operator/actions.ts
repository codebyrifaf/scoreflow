"use server";

/**
 * The operator's money actions (Milestone 21): record a payment, suspend an
 * account.
 *
 * SECURITY: every one of these re-checks `requireOperator()` on the server. The
 * fact that the buttons only render on the operator dashboard is a UI detail, not
 * a protection — an action must never trust that it was called from the right page.
 */

import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/payments";
import { poundsToPence } from "@/lib/money";
import { suspendBrand, compBrand, uncompBrand } from "@/lib/subscriptions";
import { deleteBrandCascade } from "@/lib/brands";
import { blockReviewLink, unblockReviewLink } from "@/lib/restaurants";
import { isReviewPlatform } from "@/lib/review-platforms";
import { getOwnerByEmail } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";
import { sendEmail } from "@/lib/email";

export type PaymentState = { error: string } | { ok: true } | undefined;

/**
 * Log money received and switch the account on. Bound in the client as
 * `recordPaymentAction.bind(null, brandId)`.
 *
 * The operator types POUNDS ("19.99"); we convert once, here, and everything from
 * this point inward is integer PENCE — see lib/money.ts for why.
 */
export async function recordPaymentAction(
  brandId: number,
  _prev: PaymentState,
  formData: FormData
): Promise<PaymentState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const amountPence = poundsToPence(String(formData.get("amountPounds") ?? ""));
  const periodDays = Number(String(formData.get("periodDays") ?? "").trim());

  if (amountPence === null) {
    return { error: "Enter the amount received, in pounds (e.g. 29.99)." };
  }
  if (!Number.isInteger(periodDays) || periodDays <= 0) {
    return { error: "Pick what the payment covers." };
  }

  try {
    await recordPayment({
      brandId,
      amountPence,
      periodDays,
      recordedBy: access.operatorEmail,
    });
  } catch {
    return { error: "Could not record the payment. Please try again." };
  }

  revalidatePath("/operator");
  revalidatePath("/admin");
  return { ok: true };
}

/** Suspend an account (non-payment / abuse). Reversible by recording a payment. */
export async function suspendAccountAction(
  brandId: number,
  _formData: FormData
): Promise<void> {
  const access = await requireOperator();
  if (!access.authorized) return;

  await suspendBrand(brandId);
  revalidatePath("/operator");
  revalidatePath("/operator/customers");
}

/**
 * Give an account FREE, permanent access — "comp" it (Milestone 33). For a friend's
 * restaurant, a free pilot, or your own demo. Reversible via `uncompAccountAction`,
 * and recorded in the audit log (not dangerous, but "who got free service and when"
 * is worth keeping). Not customer-notified — it's good news the operator can pass on.
 */
export async function compAccountAction(brandId: number): Promise<void> {
  const access = await requireOperator();
  if (!access.authorized) return;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true },
  });
  if (!brand) return;

  await compBrand(brandId);
  await audit({
    operatorEmail: access.operatorEmail,
    action: "comp_account",
    targetBrandId: brandId,
    targetLabel: brand.name,
    detail: "granted free (comped) access",
  });

  revalidatePath("/operator");
  revalidatePath("/operator/customers");
}

/** End an account's free access (Milestone 33) — reverse of `compAccountAction`.
 *  Drops them onto a fresh 14-day trial rather than cutting them off. Audited. */
export async function uncompAccountAction(brandId: number): Promise<void> {
  const access = await requireOperator();
  if (!access.authorized) return;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true },
  });
  if (!brand) return;

  await uncompBrand(brandId);
  await audit({
    operatorEmail: access.operatorEmail,
    action: "uncomp_account",
    targetBrandId: brandId,
    targetLabel: brand.name,
    detail: "ended free access — moved to a 14-day trial",
  });

  revalidatePath("/operator");
  revalidatePath("/operator/customers");
}

// ── Review-link oversight (Milestone 39) ────────────────────────────────────
//
// The operator can SEE every customer's review links (they're the restaurant's own
// PUBLIC page URLs — config, not diner feedback, so this doesn't breach the
// "operator never sees content" boundary) and switch a bad one OFF. Disabling keeps
// the URL but hides the tile from diners; the owner sees it flagged in Settings.
// Reactive, not a gate — links go live by default, since the M29 host-allowlist
// already blocks phishing; this only catches "real platform link, wrong page".

export type ReviewLinkState = { error: string } | { ok: true } | undefined;

/** Turn a customer's review-link platform OFF (M39). Audited. */
export async function blockReviewLinkAction(
  restaurantId: number,
  platform: string,
  formData: FormData
): Promise<void> {
  const access = await requireOperator();
  if (!access.authorized) return;
  if (!isReviewPlatform(platform)) return;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, brandId: true },
  });
  if (!restaurant) return;

  const reason = String(formData.get("reason") ?? "").trim();
  await blockReviewLink(restaurantId, platform);
  await audit({
    operatorEmail: access.operatorEmail,
    action: "block_review_link",
    targetBrandId: restaurant.brandId ?? 0,
    targetLabel: `${restaurant.name} · ${platform}`,
    detail: reason || "(no reason given)",
  });

  if (restaurant.brandId) {
    revalidatePath(`/operator/customers/${restaurant.brandId}/links`);
  }
}

/** Turn a customer's review-link platform back ON (M39). Audited. */
export async function unblockReviewLinkAction(
  restaurantId: number,
  platform: string
): Promise<void> {
  const access = await requireOperator();
  if (!access.authorized) return;
  if (!isReviewPlatform(platform)) return;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, brandId: true },
  });
  if (!restaurant) return;

  await unblockReviewLink(restaurantId, platform);
  await audit({
    operatorEmail: access.operatorEmail,
    action: "unblock_review_link",
    targetBrandId: restaurant.brandId ?? 0,
    targetLabel: `${restaurant.name} · ${platform}`,
    detail: "re-enabled",
  });

  if (restaurant.brandId) {
    revalidatePath(`/operator/customers/${restaurant.brandId}/links`);
  }
}

// ── The two emergency levers (Milestone 22) ─────────────────────────────────
//
// The operator no longer manages customer accounts. These two powers are the
// unavoidable exceptions for a platform owner, and BOTH are dangerous — so both
// are written to an audit log and BOTH notify the customer by email.
//
// Be honest about the rescue lever in particular: an operator who changes an
// account's login email to one they control could then run "forgot password" and
// take the account over — including reading that restaurant's private feedback.
// We cannot prevent that (whoever holds the database can read anything anyway), so
// instead we make it VISIBLE rather than silent: it's logged, and the OLD address
// is emailed too, so a real owner learns their account was moved out from under
// them even when they weren't the one who asked.

/** Write an immutable record of a privileged action. Never blocks the action. */
async function audit(input: {
  operatorEmail: string;
  action:
    | "rescue_email"
    | "delete_account"
    | "comp_account"
    | "uncomp_account"
    | "block_review_link"
    | "unblock_review_link";
  targetBrandId: number;
  targetLabel: string;
  detail: string;
}): Promise<void> {
  try {
    await prisma.operatorAudit.create({ data: input });
  } catch (err) {
    // An audit failure must not swallow the action, but it MUST be loud.
    console.error("[audit] FAILED to record operator action:", input, err);
  }
}

export type RescueState = { error: string } | { ok: true } | undefined;

/**
 * RESCUE: change an account's login email.
 *
 * The only way back for a customer who lost access to their inbox — without it,
 * their restaurant, their NFC chips and their entire feedback history are
 * unrecoverable, and "forgot password" can't help because it emails the address
 * they've lost. Verify who they are out-of-band (a phone call) before using it.
 */
export async function rescueAccountEmail(
  brandId: number,
  _prev: RescueState,
  formData: FormData
): Promise<RescueState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return { error: "Enter a valid email address." };
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, owners: { select: { id: true, email: true }, orderBy: { id: "asc" } } },
  });
  const owner = brand?.owners[0];
  if (!brand || !owner) {
    return { error: "That account has no owner login." };
  }
  if (owner.email === newEmail) {
    return { error: "That's already the login email." };
  }
  if ((await getOwnerByEmail(newEmail)) || (await getOperatorByEmail(newEmail))) {
    return { error: "That email is already in use by another account." };
  }

  const oldEmail = owner.email;

  try {
    // Bump tokenVersion too: moving the login identity must kill every existing
    // session on that account (M17). Whoever holds it next signs in fresh.
    await prisma.owner.update({
      where: { id: owner.id },
      data: { email: newEmail, tokenVersion: { increment: 1 } },
    });
  } catch {
    return { error: "Could not change the login email. Please try again." };
  }

  await audit({
    operatorEmail: access.operatorEmail,
    action: "rescue_email",
    targetBrandId: brandId,
    targetLabel: brand.name,
    detail: `${oldEmail} → ${newEmail}`,
  });

  // Tell BOTH addresses. The new one so they can get in; the OLD one so that if
  // this wasn't actually requested by the real owner, they find out.
  const body =
    `The login email for your ScoreFlow account "${brand.name}" was changed from ` +
    `${oldEmail} to ${newEmail} by ScoreFlow support.\n\n` +
    `If you asked for this, you can now sign in with the new address (use "Forgot ` +
    `password" to set a password).\n\n` +
    `If you did NOT ask for this, reply immediately — your account may have been ` +
    `taken over.`;
  await sendEmail({ to: newEmail, subject: "Your ScoreFlow login email was changed", body });
  await sendEmail({ to: oldEmail, subject: "Your ScoreFlow login email was changed", body });

  revalidatePath("/operator");
  return { ok: true };
}

export type DeleteAccountState = { error: string } | { ok: true } | undefined;

/**
 * DELETE an account (abuse, a legal request, or purging a long-gone customer whose
 * data we're paying to store). Destroys everything, exactly like the owner's own
 * "close account". Requires typing the account name, and is audited.
 *
 * Prefer SUSPEND for non-payment — that's reversible; this is not.
 */
export async function deleteAccountAsOperator(
  brandId: number,
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true },
  });
  if (!brand) return { error: "Account not found." };

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== brand.name) {
    return { error: `Type “${brand.name}” exactly to confirm.` };
  }

  try {
    await deleteBrandCascade(brandId);
  } catch {
    return { error: "Could not delete the account. Please try again." };
  }

  // Audited AFTER the delete, and with no FK to the (now-gone) brand — an audit
  // record has to outlive the thing it describes, or it's worthless as evidence.
  await audit({
    operatorEmail: access.operatorEmail,
    action: "delete_account",
    targetBrandId: brandId,
    targetLabel: brand.name,
    detail: "account and all data permanently deleted",
  });

  revalidatePath("/operator");
  return { ok: true };
}
