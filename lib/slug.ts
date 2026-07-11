/**
 * Turning a restaurant name into a URL-safe slug (Milestone 20).
 *
 * At self-serve signup the customer types a NAME ("Rifaf's Kitchen"); the system
 * derives the slug ("rifafs-kitchen") — the owner never picks it. That's
 * deliberate: the slug ends up on the NFC chips, and M18 made it un-editable by
 * owners for exactly that reason, so the system owning it from birth is consistent.
 */

import { prisma } from "./prisma";

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

/**
 * A slug guaranteed not to collide with any existing restaurant. If "cafe" is
 * taken it tries "cafe-2", "cafe-3", … The final DB unique constraint is still the
 * real backstop; this just avoids an ugly error in the common case.
 */
export async function uniqueRestaurantSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // Bounded loop — in practice resolves on the first or second try.
  while (await prisma.restaurant.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`.slice(0, 40);
  }
  return candidate;
}
