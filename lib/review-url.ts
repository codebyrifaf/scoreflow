/**
 * Validating a review URL (Milestone 25 — security hardening; extended in M29).
 *
 * ⚠️ DEPENDENCY-FREE ON PURPOSE. A client component (the Settings form's "Test this
 * link" button) imports this to decide whether a typed URL is safe to put in an
 * `href`. So this file must never import Prisma or anything server-only, or the
 * database client gets dragged into the browser bundle. Same rule lib/money.ts lives
 * under (M23).
 *
 * ── The hole this closes ─────────────────────────────────────────────────────
 * A review link used to be checked against `^https?://` — i.e. ANY URL. And the
 * `/r/<slug>/go-review` redirect forwards a diner to whatever that link is. So a
 * signed-up owner could set their review link to `https://phishing.example` and hand
 * out `https://scoreflow.app/r/their-slug/go-review` — an **open redirect on our own
 * domain**, which lends our credibility to a phishing link and slips past naive URL
 * filters.
 *
 * M29 added three more platforms, i.e. three more chances to reopen exactly that
 * hole. So every platform gets a host allowlist; none of them accept "any https URL".
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * `new URL()` parses the authority properly, so there are no string-matching games
 * (`google.com.evil.com` is not Google, and no amount of `.includes()` will tell you
 * that reliably). Then the HOST is checked against what each platform really uses.
 */

/** The platforms we support. Fixed set — see lib/review-platforms.ts. */
export type ReviewPlatform = "google" | "tripadvisor" | "yelp" | "zomato";

/**
 * Hosts real GOOGLE review links use.
 *
 * Google needs a bespoke list because its links live on short domains that share no
 * common shape (`g.page`, `g.co`, `goo.gl`) — the generic brand-domain rule below
 * cannot express that.
 */
const GOOGLE_EXACT_HOSTS = new Set([
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
 * Does this host belong to `brand`, on any of that brand's real country domains?
 *
 * Tripadvisor, Yelp and Zomato each operate dozens of country sites
 * (tripadvisor.co.uk, tripadvisor.com.au, yelp.ca, …), so an exact-host list would be
 * both enormous and permanently out of date. Instead:
 *
 *   • strip one optional leading "www.";
 *   • the FIRST label must be exactly the brand;
 *   • whatever remains must LOOK like a public suffix — one or two labels of 2–3
 *     letters ("com", "co.uk", "com.au").
 *
 * That last rule is what does the security work. Without it, `tripadvisor.evil.com`
 * would pass (its first label IS "tripadvisor"), and we'd have handed an attacker the
 * open redirect back. With it:
 *
 *   tripadvisor.com          ✅  first label matches, "com" is TLD-shaped
 *   tripadvisor.co.uk        ✅  "co.uk" is TLD-shaped
 *   www.tripadvisor.com.au   ✅  www stripped, "com.au" is TLD-shaped
 *   eviltripadvisor.com      ❌  first label is "eviltripadvisor", not "tripadvisor"
 *   tripadvisor.evil.com     ❌  "evil.com" — "evil" is 4 letters, not TLD-shaped
 *   tripadvisor.com.evil.com ❌  three labels left over
 *   yelp.com.attacker.net    ❌  same
 */
const TLD_SHAPED = /^[a-z]{2,3}(\.[a-z]{2,3})?$/;

function isBrandDomain(host: string, brand: string): boolean {
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  const firstDot = bare.indexOf(".");
  if (firstDot === -1) return false; // no TLD at all

  const label = bare.slice(0, firstDot);
  const rest = bare.slice(firstDot + 1);

  return label === brand && TLD_SHAPED.test(rest);
}

/**
 * Is `url` a plausible review link for `platform`?
 *
 * Blank is handled by the caller (every field is optional); this only judges
 * non-empty values. Returns false for anything that isn't an https URL on a host that
 * platform genuinely uses — which is what keeps /go-review from becoming an open
 * redirect.
 */
export function isValidReviewUrl(platform: ReviewPlatform, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // not a URL at all (covers "javascript:alert(1)" typed with no colon-slash-slash too)
  }

  // https only. A review link is public, and this value ends up in an `href` and in a
  // server-side redirect — `javascript:`, `data:` and plain `http:` are all refused
  // here, which is the single check that stops a typed `javascript:` URL becoming
  // self-XSS in the Settings "Test this link" button.
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();

  switch (platform) {
    case "google":
      // Exact host, or a genuine subdomain of google.com. The LEADING DOT is what
      // stops `evilgoogle.com` and `google.com.evil.com` from matching.
      return GOOGLE_EXACT_HOSTS.has(host) || host.endsWith(".google.com");
    case "tripadvisor":
      return isBrandDomain(host, "tripadvisor");
    case "yelp":
      return isBrandDomain(host, "yelp");
    case "zomato":
      return isBrandDomain(host, "zomato");
    default:
      // An unknown platform must FAIL CLOSED. If a new platform is ever added to the
      // registry and forgotten here, its links are rejected rather than waved through
      // unvalidated — the safe direction to be wrong in.
      return false;
  }
}

/** The message shown when a link isn't valid for that platform. */
export function reviewUrlError(platform: ReviewPlatform): string {
  switch (platform) {
    case "google":
      return GOOGLE_REVIEW_URL_ERROR;
    case "tripadvisor":
      return "Enter your Tripadvisor page link (an https link on tripadvisor.com or your country's Tripadvisor site).";
    case "yelp":
      return "Enter your Yelp page link (an https link on yelp.com).";
    case "zomato":
      return "Enter your Zomato page link (an https link on zomato.com).";
    default:
      return "That doesn't look like a valid review link.";
  }
}

/** The message shown when a link isn't a valid Google review URL. */
export const GOOGLE_REVIEW_URL_ERROR =
  "Enter your Google review link (it should be an https link on google.com, g.page, or maps.app.goo.gl).";

/**
 * Back-compat wrapper — the brand console (app/b/[brandSlug]/actions.ts) still edits
 * only the Google link. Kept so M29 doesn't have to touch that code path.
 */
export function isValidGoogleReviewUrl(url: string): boolean {
  return isValidReviewUrl("google", url);
}
