/**
 * Turning a name into a URL-safe slug (Milestone 20).
 *
 * The customer types a NAME ("Uncle Bobo's Dhanmondi"); the system derives the slug
 * ("uncle-bobo-s-dhanmondi") — they never pick it. That's deliberate: the slug ends up
 * printed on QR cards and written to NFC chips, and M18 made it un-editable by owners
 * for exactly that reason, so the system owning it from birth is consistent.
 *
 * ⚠️ DEPENDENCY-FREE ON PURPOSE. The add-location form is a CLIENT component and
 * imports `slugify` to show the owner the feedback URL their QR codes will carry,
 * before they commit to a name. So this file must never import Prisma or anything
 * server-only, or the database client gets dragged into the browser bundle. The same
 * rule lib/money.ts and lib/review-url.ts live under.
 *
 * The half that needs the database — checking a candidate slug is actually free —
 * lives in lib/restaurants.ts as `uniqueRestaurantSlug`, next to the table it queries.
 */

/** "Rifaf's Café #2!" → "rifafs-cafe-2". Always non-empty (falls back to "r"). */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD") // split accented letters so we can drop the marks
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics → one hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 40);
  return base || "r";
}

// `uniqueRestaurantSlug` used to live here. It queries the Restaurant table, so it
// moved to lib/restaurants.ts — both because that's where Restaurant access belongs,
// and because its `prisma` import made this whole module unimportable from a client
// component (see the header note).
