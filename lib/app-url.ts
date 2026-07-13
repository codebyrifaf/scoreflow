/**
 * Our public base URL, and the URLs built from it (Milestone 30).
 *
 * This is the ONE place that answers "what's our address on the internet?". It used
 * to be answered in three places — a private `appUrl()` in lib/notifications.ts (for
 * the links inside alert emails) and an inline copy in app/layout.tsx (for OG/canonical
 * metadata) — and now also needs answering for the QR codes on the printable kit. Three
 * copies of the same precedence rule is two too many, so they all come here.
 *
 * ⚠️ Dependency-free on purpose: this is imported by both server code and the metadata
 * layer, and (indirectly, via the URL string) underpins the QR codes. No Prisma, no
 * server-only imports.
 */

/**
 * The absolute origin of the app, with NO trailing slash.
 *
 * Precedence:
 *   1. `APP_URL` — set explicitly (production uses this; it's in the Vercel env).
 *   2. `https://$VERCEL_URL` — Vercel sets `VERCEL_URL` automatically per deployment.
 *   3. `http://localhost:3000` — local dev fallback.
 *
 * ⚠️ QR-code correctness depends on this being right in production: a QR encodes an
 * ABSOLUTE URL (a diner's camera has no "current origin" to resolve a relative path
 * against), so if `APP_URL` were wrong, every printed code would point somewhere wrong.
 * It's set correctly in prod today.
 */
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  // Normalise: never a trailing slash, so `${appUrl()}${path}` is always clean.
  return raw.replace(/\/+$/, "");
}

/**
 * The absolute diner-facing feedback URL for a restaurant, optionally pre-filled with
 * a table. This is exactly what a QR code (or an NFC chip) encodes.
 *
 * `table` is `encodeURIComponent`-escaped so a label with a space, `#`, or unicode
 * ("Patio 2", "Table #3") survives into a valid URL — matching how TablesManager builds
 * the same link client-side. `undefined`/empty table → the general link (no `?table=`),
 * used for a counter or a general poster.
 */
export function feedbackUrl(slug: string, table?: string | null): string {
  const base = `${appUrl()}/r/${encodeURIComponent(slug)}/feedback`;
  if (table && table.trim() !== "") {
    return `${base}?table=${encodeURIComponent(table)}`;
  }
  return base;
}
