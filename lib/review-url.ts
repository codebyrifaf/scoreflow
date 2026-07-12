/**
 * Validating a Google review URL (Milestone 25 — security hardening).
 *
 * ── The hole this closes ─────────────────────────────────────────────────────
 * The review link was only checked against `^https?://` — ANY URL. And the
 * `/r/<slug>/go-review` redirect forwards a diner to whatever that link is. So a
 * signed-up owner could set their review link to `https://phishing.example` and
 * hand out `https://scoreflow.app/r/their-slug/go-review` — an **open redirect on
 * our own domain**, which lends our credibility to a phishing link and slips past
 * naive URL filters.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * A review link must actually point at Google. We check the host against the small
 * set of domains real Google review links use. `new URL()` parses the authority
 * safely (no string-matching games like `google.com.evil.com`), and the host check
 * requires either an EXACT match or a `.google.com` SUBdomain — so `evilgoogle.com`
 * and `google.com.evil.com` are both rejected.
 */

/** Hosts real Google review links use. */
const EXACT_HOSTS = new Set([
  "google.com",
  "g.page",
  "g.co",
  "goo.gl",
  "maps.app.goo.gl",
  "maps.google.com",
  "search.google.com",
  "business.google.com",
]);

/**
 * Is `url` a plausible Google review link? Blank is handled by the caller (the
 * field is optional); this only judges non-empty values.
 */
export function isValidGoogleReviewUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // not a URL at all
  }

  // Only https. A review link is public and should never be plain http.
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();

  // Exact host, or a genuine subdomain of google.com (the leading dot is what
  // stops `evilgoogle.com` and `google.com.evil.com` matching).
  return EXACT_HOSTS.has(host) || host.endsWith(".google.com");
}

/** The message shown when a link isn't a valid Google review URL. */
export const GOOGLE_REVIEW_URL_ERROR =
  "Enter your Google review link (it should be an https link on google.com, g.page, or maps.app.goo.gl).";
