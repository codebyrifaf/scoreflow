/**
 * Working out WHO is calling us — the trusted client IP (Milestone 17).
 *
 * This is shared by the two places that rate-limit: the public feedback API and
 * the login guard in auth.ts.
 *
 * ── Why this file exists (the bug it fixes) ──────────────────────────────────
 * The old code did this:
 *
 *     const fwd = request.headers.get("x-forwarded-for") ?? "";
 *     const ip = fwd.split(",")[0]?.trim() || ...;      // ← the LEFTMOST entry
 *
 * `X-Forwarded-For` is a list that each proxy **appends** to. So the leftmost
 * entry is whatever the ORIGINAL CALLER sent — it is fully attacker-controlled.
 * Anyone could send a random `X-Forwarded-For` on every request, get a brand-new
 * "IP", and the per-IP rate limit would never fire. That made the spam guard
 * decorative: a competitor could flood a restaurant's dashboard with 1-star
 * feedback at will.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * Only trust a header that our own infrastructure SETS (and therefore overwrites),
 * not one the client can add to:
 *
 *   1. `x-vercel-forwarded-for` — set by Vercel's edge on every request. A client
 *      cannot forge it: whatever they send is replaced. This is the real one in
 *      production.
 *   2. `x-real-ip` — also set by Vercel / most reverse proxies.
 *   3. `x-forwarded-for` — UNTRUSTED. We only fall back to it outside production
 *      (i.e. `npm run dev`), where there's no proxy in front of us and there is
 *      nothing to attack.
 *
 * If we can't establish an IP we return "unknown", and every such caller shares
 * one bucket. That fails CLOSED (they throttle each other) rather than open.
 */

import { createHash } from "node:crypto";

/**
 * The caller's IP, from a header our infrastructure controls.
 *
 * Takes a `Headers` object rather than a `Request` so both callers can use it:
 * the API route passes `request.headers`, and auth.ts passes `await headers()`
 * from `next/headers`.
 */
export function clientIpFrom(headers: Headers): string {
  // Vercel sets this itself and strips any client-supplied copy → trustworthy.
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    // It can still be a list; the FIRST entry here is the real client, because
    // Vercel — not the client — wrote this header.
    const ip = vercel.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Local development only. In production this header is attacker-controlled, so
  // trusting it is exactly the bug we're fixing — never do it when deployed.
  if (process.env.NODE_ENV !== "production") {
    const fwd = headers.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return "unknown";
}

/**
 * A salted SHA-256 of an IP. We store this, never the raw address — so the
 * database holds no directly-identifying network data, but we can still say
 * "is this the same caller as a moment ago?".
 *
 * The salt is its own env var (`IP_HASH_SALT`), falling back to `AUTH_SECRET`.
 * Why separate: rotating `AUTH_SECRET` is our emergency "sign everybody out"
 * lever. If it doubled as the IP salt, pulling that lever would silently
 * invalidate every stored `ipHash` and wipe the spam guard's memory at exactly
 * the moment we're under attack.
 */
export function hashIp(ip: string): string {
  // ⚠️ `||`, NOT `??`. Nullish coalescing treats an EMPTY STRING as a real value, so
  // `IP_HASH_SALT=""` — which is exactly what `.env.example` used to ship, and what
  // a blank field in a hosting dashboard produces — resolved to a salt of "" and
  // silently skipped the fallback to AUTH_SECRET. The result was plain, UNSALTED
  // SHA-256 of the IP. There are only ~4.3 billion IPv4 addresses, so an unsalted
  // hash of one is reversible with a rainbow table in minutes, which defeats the
  // whole point of this function: that the database holds nothing that identifies a
  // diner's network. An empty/whitespace value must mean "not set".
  const salt =
    process.env.IP_HASH_SALT?.trim() || process.env.AUTH_SECRET?.trim() || "";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

/** Convenience: the caller's hashed IP in one step. */
export function clientIpHash(headers: Headers): string {
  return hashIp(clientIpFrom(headers));
}
