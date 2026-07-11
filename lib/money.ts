/**
 * Money (Milestone 23 — the product is sold in the UK, so money is GBP).
 *
 * ── The one rule ─────────────────────────────────────────────────────────────
 * Money is ALWAYS stored and passed around as an INTEGER NUMBER OF PENCE.
 * £19.99 is `1999`, never `19.99`.
 *
 * Floating-point numbers cannot represent most decimal fractions exactly, so
 * pounds-as-floats silently lose slivers of a penny; add up a few thousand of them
 * and a billing ledger stops reconciling. Integers can't drift. Pounds exist only
 * at the very edges — when a human types an amount in, and when we print one out.
 *
 * ── Why this is its own file ─────────────────────────────────────────────────
 * It has NO imports. That matters: `lib/payments.ts` pulls in Prisma, so a client
 * component that imported its formatter would drag the whole database client into
 * the browser bundle. Formatting is needed on both sides of the wire, so it lives
 * here, dependency-free.
 */

/** Pence → "£19.99". The one place money becomes a string. */
export function formatGbp(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * What a human typed ("19.99", "£19.99", " 20 ") → 1999 pence.
 *
 * Returns `null` for anything that isn't a sane positive amount, so the caller has
 * to handle it explicitly rather than quietly storing a `NaN` in the ledger.
 */
export function poundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "");
  const pounds = Number(cleaned);
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  // Round to the nearest penny — "19.999" is a typo, not a third of a penny.
  return Math.round(pounds * 100);
}
