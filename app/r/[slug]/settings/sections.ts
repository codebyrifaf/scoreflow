/**
 * The Settings page's sections, in menu order, with the name the menu shows.
 *
 * A plain module (no "use client"): the server page reads it to decide which
 * sections this person gets and which one opens first, and the client shell reads
 * it to draw the menu. (Values exported from a "use client" file can't be read on
 * the server — the server only ever sees a reference to them.)
 */

export const SETTINGS_SECTIONS = {
  restaurant: "Restaurant",
  reviews: "Review links",
  ratings: "Ratings",
  notifications: "Notifications",
  logo: "Logo",
  menu: "Menu",
  suggestions: "Guest suggestions",
  till: "Till & Square",
  account: "Close account",
} as const;

export type SectionId = keyof typeof SETTINGS_SECTIONS;

/**
 * The four sections that are ONE form with ONE "Save changes" button (SettingsForm).
 * Kept together on purpose: the save action writes all of these fields at once.
 */
export const FORM_SECTIONS: readonly SectionId[] = [
  "restaurant",
  "reviews",
  "ratings",
  "notifications",
];

/** Is `value` one of the section names? (For `?section=` — never trust a URL.) */
export function isSectionId(value: unknown): value is SectionId {
  return typeof value === "string" && Object.hasOwn(SETTINGS_SECTIONS, value);
}
