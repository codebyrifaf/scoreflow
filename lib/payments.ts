/**
 * Recording money actually received (Milestone 21).
 *
 * Payment moves OUT OF BAND — the customer sends taka via bKash, because online
 * recurring billing isn't available to a Bangladeshi business yet. The operator
 * then logs it here, which does two things at once, atomically:
 *
 *   1. writes a `Payment` row  → the ledger the sales dashboard adds up;
 *   2. activates the account   → sets `subStatus: "active"` and pushes
 *                                `currentPeriodEnd` out by the period they bought.
 *
 * Doing both in ONE transaction is the point: you can never end up having taken
 * someone's money without switching their account on, or vice-versa.
 *
 * When a real gateway (SSLCommerz/bKash API) lands, its webhook calls this same
 * function and nothing else in the app has to change.
 */

import { prisma } from "./prisma";

/** What a period costs, for the operator's convenience. Prices are per MONTH. */
export const PERIOD_OPTIONS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 365, label: "1 year" },
] as const;

/**
 * Log a payment and switch the account on.
 *
 * `amountBdt` is what they actually handed over; `periodDays` is what it buys.
 * We derive `monthlyPrice` from the two so the MRR figure stays honest even when
 * someone pays for a year up front.
 *
 * The new period is added to whichever is LATER — now, or their existing
 * `currentPeriodEnd`. So a customer who renews early doesn't lose the days they'd
 * already paid for.
 */
export async function recordPayment(input: {
  brandId: number;
  amountBdt: number;
  periodDays: number;
  recordedBy: string;
}) {
  const { brandId, amountBdt, periodDays, recordedBy } = input;

  return prisma.$transaction(async (tx) => {
    const brand = await tx.brand.findUnique({
      where: { id: brandId },
      select: { currentPeriodEnd: true },
    });
    if (!brand) throw new Error("Account not found");

    // Renewing early must not throw away days they already paid for.
    const now = Date.now();
    const startFrom = Math.max(
      now,
      brand.currentPeriodEnd?.getTime() ?? 0
    );
    const newPeriodEnd = new Date(startFrom + periodDays * 24 * 60 * 60 * 1000);

    // Normalise to a monthly figure so MRR is comparable across period lengths
    // (someone paying 12,000 for a year is 1,000/month, not 12,000/month).
    const monthlyPrice = Math.round(amountBdt / (periodDays / 30));

    await tx.payment.create({
      data: { brandId, amountBdt, periodDays, recordedBy },
    });

    await tx.brand.update({
      where: { id: brandId },
      data: {
        subStatus: "active",
        currentPeriodEnd: newPeriodEnd,
        monthlyPrice,
        activatedBy: recordedBy,
        activatedAt: new Date(),
      },
    });

    return { newPeriodEnd, monthlyPrice };
  });
}
