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

// ── Per-category templates: the no-AI fallback ───────────────────────────────
//
// Chips for a dish, keyed by the category the owner (or the menu extractor) gave
// it. These are what a restaurant gets when `AI_PROVIDER` is unset — good enough
// to be genuinely useful, and they mean the menu feature works with no API key,
// no cost, and nothing that can fail at runtime.
//
// Kept HERE rather than in lib/ai.ts because this file is the chip vocabulary and
// is dependency-free, so a client component can import it. Same rule lib/money.ts
// and lib/review-url.ts live under.
//
// ⚠️ Short on purpose. These are buttons on a phone held by someone who wants to
// be done in ten seconds — not sentences.

interface ChipTemplate {
  positive: string[];
  negative: string[];
}

const CATEGORY_CHIPS: Record<string, ChipTemplate> = {
  burger: {
    positive: ["Juicy", "Great bun", "Cooked right", "Good size"],
    negative: ["Dry", "Overcooked", "Soggy bun", "Too small"],
  },
  pizza: {
    positive: ["Great base", "Good toppings", "Nice and hot"],
    negative: ["Soggy base", "Undercooked", "Too little topping", "Arrived cold"],
  },
  curry: {
    positive: ["Great flavour", "Spiced well", "Tender meat"],
    negative: ["Too oily", "Not spicy enough", "Too salty", "Watery"],
  },
  rice: {
    positive: ["Fluffy", "Well flavoured", "Good portion"],
    negative: ["Dry", "Undercooked", "Bland", "Too oily"],
  },
  pasta: {
    positive: ["Cooked right", "Great sauce", "Good portion"],
    negative: ["Overcooked", "Bland sauce", "Too dry", "Arrived cold"],
  },
  chicken: {
    positive: ["Juicy", "Crispy", "Well seasoned"],
    negative: ["Dry", "Undercooked", "Too greasy", "Bland"],
  },
  seafood: {
    positive: ["Very fresh", "Cooked right", "Well seasoned"],
    negative: ["Not fresh", "Overcooked", "Too salty", "Fishy"],
  },
  salad: {
    positive: ["Very fresh", "Great dressing", "Good portion"],
    negative: ["Not fresh", "Too little", "Too much dressing", "Bland"],
  },
  sandwich: {
    positive: ["Fresh bread", "Good filling", "Great size"],
    negative: ["Stale bread", "Too little filling", "Soggy", "Too small"],
  },
  dessert: {
    positive: ["Delicious", "Not too sweet", "Great texture"],
    negative: ["Too sweet", "Dry", "Not fresh", "Too small"],
  },
  coffee: {
    positive: ["Great coffee", "Perfect temperature", "Smooth"],
    negative: ["Too bitter", "Too weak", "Not hot enough", "Burnt taste"],
  },
  drink: {
    positive: ["Refreshing", "Well made", "Good size"],
    negative: ["Too sweet", "Watered down", "Not cold", "Too small"],
  },
  starter: {
    positive: ["Great flavour", "Nice and hot", "Good portion"],
    negative: ["Arrived cold", "Too oily", "Too small", "Bland"],
  },
  soup: {
    positive: ["Great flavour", "Nice and hot", "Good consistency"],
    negative: ["Not hot enough", "Too salty", "Watery", "Bland"],
  },
  breakfast: {
    positive: ["Cooked right", "Nice and hot", "Good portion"],
    negative: ["Overcooked", "Arrived cold", "Too greasy", "Too small"],
  },
};

/** Used when a dish has no category, or one we don't have a template for. */
const DEFAULT_CATEGORY_CHIPS: ChipTemplate = {
  positive: ["Delicious", "Well cooked", "Good portion"],
  negative: ["Not tasty", "Arrived cold", "Too small", "Took too long"],
};

/** The category names a menu extractor should try to use. */
export const KNOWN_CATEGORIES: readonly string[] = Object.keys(CATEGORY_CHIPS);

/**
 * Template chips for a dish, prefixed with the dish itself so the diner sees
 * "Burger — Dry" rather than a bare "Dry" with no context.
 *
 * `dishName` is trimmed to a short label: the whole point is a tappable button,
 * and a long dish name would push the chip off a phone screen.
 */
export function templateChipsFor(
  dishName: string,
  category: string | null
): ChipTemplate {
  const t =
    (category && CATEGORY_CHIPS[category.trim().toLowerCase()]) ||
    DEFAULT_CATEGORY_CHIPS;
  return { positive: [...t.positive], negative: [...t.negative] };
}

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
