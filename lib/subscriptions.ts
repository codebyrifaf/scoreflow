/**
 * Subscription lifecycle (Milestone 20) — the one place that decides whether an
 * account may still use the product.
 *
 * A subscription belongs to a `Brand` (the paying account). Money currently moves
 * OUT of band — the customer pays us directly and the operator records it — so this
 * module models only the LIFECYCLE. A real gateway (Stripe, now that the product is
 * sold in the UK) will later call `activate()` from a webhook instead of the
 * operator clicking a button; nothing else here has to change.
 *
 *   trialing → active → expired / canceled
 *
 * ⚠️ The GATE that enforces this lives in lib/auth-guard.ts and locks only the
 * private dashboards. The public feedback page is never gated (physical NFC chips).
 */

import { prisma } from "./prisma";

/** How long a fresh signup gets to try the product free. */
export const TRIAL_DAYS = 14;

/** The subset of a Brand this module needs to make a decision. */
export interface SubscriptionInfo {
  subStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

export type SubscriptionState =
  | { live: true; kind: "trial" | "active"; trialDaysLeft?: number }
  | { live: false; kind: "trial_expired" | "canceled" };

/**
 * Is this account allowed to use the product right now?
 *
 * The rules, in order:
 *   • COMPED (legacy/operator-made): `trialEndsAt` is null AND status isn't a paid
 *     one → always live. These accounts predate self-serve signup and the operator
 *     manages them directly, so we never lock them out.
 *   • ACTIVE: someone (operator now, a gateway later) marked it paid → live, unless
 *     a `currentPeriodEnd` has passed.
 *   • TRIALING: live until `trialEndsAt`.
 *   • anything else (canceled, or a trial whose clock ran out) → not live.
 */
export function subscriptionState(
  sub: SubscriptionInfo,
  now: Date = new Date()
): SubscriptionState {
  // ⚠️ CANCELED IS CHECKED FIRST, AND THAT ORDER IS THE WHOLE POINT.
  //
  // It used to be checked *after* the comped rule below, which quietly broke the
  // operator's "Suspend" button for any comped/legacy account: suspending writes
  // subStatus "canceled" but leaves `trialEndsAt` null, so the comped rule matched
  // first and returned `live: true`. The operator saw the account flip to
  // "canceled" in their console and reasonably believed they'd cut off a
  // non-paying customer — who in fact kept full access to the product, forever.
  // An explicit suspension must always win over an implicit "comped" default.
  if (sub.subStatus === "canceled") {
    return { live: false, kind: "canceled" };
  }

  // Comped / legacy accounts: no trial clock was ever set and they're not on a paid
  // plan → treat as always-on (the operator runs them by hand).
  if (sub.trialEndsAt === null && sub.subStatus !== "active") {
    return { live: true, kind: "active" };
  }

  if (sub.subStatus === "active") {
    // A paid account can still lapse if its period has ended and wasn't renewed.
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now.getTime()) {
      return { live: false, kind: "canceled" };
    }
    return { live: true, kind: "active" };
  }

  // Otherwise we're on trial (status "trialing" or "expired" with a trial clock).
  if (sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime()) {
    const msLeft = sub.trialEndsAt.getTime() - now.getTime();
    return {
      live: true,
      kind: "trial",
      trialDaysLeft: Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
    };
  }

  return { live: false, kind: "trial_expired" };
}

/** Convenience boolean for the guards. */
export function isSubscriptionLive(sub: SubscriptionInfo, now?: Date): boolean {
  return subscriptionState(sub, now).live;
}

/** The trial window for a brand-new signup: now + TRIAL_DAYS. */
export function newTrialEndsAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Operator marks an account as PAID (Milestone 20 — the manual bridge until a real
 * gateway). Records who activated it and when. `periodDays` optionally sets when
 * this paid period ends (so it can lapse and need renewing); omit for open-ended.
 */
export async function activateBrand(
  brandId: number,
  activatedBy: string,
  periodDays?: number
) {
  return prisma.brand.update({
    where: { id: brandId },
    data: {
      subStatus: "active",
      activatedBy,
      activatedAt: new Date(),
      currentPeriodEnd: periodDays
        ? new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });
}

/** Operator suspends an account (non-payment / abuse). Reversible via activate. */
export async function suspendBrand(brandId: number) {
  return prisma.brand.update({
    where: { id: brandId },
    data: { subStatus: "canceled" },
  });
}

/**
 * Operator gives an account FREE, permanent access — a "comp" (Milestone 33).
 *
 * How comping works WITHOUT a new column: an account is "comped" exactly when it has
 * no trial clock (`trialEndsAt = null`) and isn't `active`/`canceled` — that's the
 * state `subscriptionState`'s comped branch treats as always-live, and it's precisely
 * how legacy operator-made accounts already look. So we just put it there: clear the
 * trial clock and any paid period, and set a non-active status. `monthlyPricePence`
 * goes to 0 so a freebie never inflates MRR.
 *
 * ⚠️ Reversible via `uncompBrand`. It's the operator's call, and it's audited.
 */
export async function compBrand(brandId: number) {
  return prisma.brand.update({
    where: { id: brandId },
    data: {
      trialEndsAt: null, // no trial clock …
      subStatus: "trialing", // … and not "active"/"canceled" ⇒ comped (see isComped)
      currentPeriodEnd: null,
      monthlyPricePence: 0, // pays nothing ⇒ contributes nothing to MRR
    },
  });
}

/**
 * End an account's free access (Milestone 33) — the reverse of `compBrand`.
 *
 * Rather than cut them off instantly, we drop them onto a fresh 14-day trial, so a
 * comp that's being wound down doesn't strand a restaurant mid-service. If they don't
 * subscribe, they lapse naturally when the trial runs out.
 */
export async function uncompBrand(brandId: number) {
  return prisma.brand.update({
    where: { id: brandId },
    data: {
      trialEndsAt: newTrialEndsAt(),
      subStatus: "trialing",
      currentPeriodEnd: null,
    },
  });
}
