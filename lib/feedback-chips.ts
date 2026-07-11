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

/** The rating at/above which we show the positive chips (below → negative). */
export const POSITIVE_FROM = 7;

/**
 * Which chips to show for a given rating. Returns an empty array when no rating
 * has been chosen yet (rating 0), so the chip section stays hidden until then.
 */
export function chipsForRating(rating: number): string[] {
  if (rating <= 0) return [];
  return rating >= POSITIVE_FROM ? POSITIVE_CHIPS : NEGATIVE_CHIPS;
}
