/**
 * Preset quick-tap feedback chips (Milestone 9).
 *
 * A time-poor diner won't type a paragraph, so after they pick a rating we show
 * a few tappable chips they can select in one second. Which set we show depends
 * on the rating: a good score gets positive chips, a low score gets
 * "what went wrong" chips. Selected chips are saved as the feedback's `tags`.
 *
 * (These are hard-coded for now. A later milestone could have Claude generate
 * restaurant-specific chips; the customer experience — instant taps — stays the
 * same.)
 */

/** Chips for a not-great experience (low ratings). */
const NEGATIVE_CHIPS = [
  "Slow service",
  "Food was cold",
  "Too pricey",
  "Small portion",
  "Not clean",
  "Wrong order",
];

/** Chips for a good experience (high ratings). */
const POSITIVE_CHIPS = [
  "Delicious",
  "Great service",
  "Cozy vibe",
  "Good value",
  "Fast service",
  "Will return",
];

/**
 * Fallback boundary, used only if a caller doesn't pass the restaurant's own
 * threshold.
 *
 * ⚠️ This used to be a hardcoded 7 that decided the chips for EVERY restaurant —
 * while the thank-you screen routed on `positiveThreshold` (default 8). The two
 * disagreed, so a diner who rated **7** was cheerfully asked "What did you love?"
 * and then shown the private *"sorry your experience fell short"* screen. M18
 * unified them: chips now follow the restaurant's own `positiveThreshold`, so what
 * the diner is asked always matches where they end up.
 */
export const DEFAULT_POSITIVE_FROM = 8;

/**
 * Every chip we will ever accept — the WHITELIST for the public API (M17).
 *
 * `tags` arrive from the browser, and the API used to accept any string ≤ 40 chars.
 * That let an attacker post arbitrary text and have it show up in the owner's
 * "Top mentions" panel — not an XSS (React escapes it), but it defaces the widget
 * the owner reads most. Tags are a CLOSED set chosen by tapping a chip, so the
 * server should accept nothing else.
 */
export const ALL_CHIPS: readonly string[] = [
  ...NEGATIVE_CHIPS,
  ...POSITIVE_CHIPS,
];

/** Is this string one of our real chips? Used to filter incoming tags. */
export function isKnownChip(tag: string): boolean {
  return ALL_CHIPS.includes(tag);
}

/**
 * Which chips to show for a given rating. Returns an empty array when no rating
 * has been chosen yet (rating 0), so the chip section stays hidden until then.
 *
 * `positiveFrom` is the restaurant's own `positiveThreshold` — the SAME number that
 * decides whether this diner ends up on the Google-review screen or the private
 * "sorry" screen. Passing it here is what keeps the question we ask ("what did you
 * love?" vs "what went wrong?") consistent with the screen they'll land on.
 */
export function chipsForRating(
  rating: number,
  positiveFrom: number = DEFAULT_POSITIVE_FROM
): string[] {
  if (rating <= 0) return [];
  return rating >= positiveFrom ? POSITIVE_CHIPS : NEGATIVE_CHIPS;
}
