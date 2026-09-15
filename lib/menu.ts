/**
 * The account's MENU — the dishes, and the quick-tap chips shown for each one.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Until now every diner on the platform saw the same six hardcoded chips
 * ("Slow service", "Food was cold" — see lib/feedback-chips.ts). They tell an
 * owner that *something* went wrong. They can never say *what*.
 *
 * A menu changes that. Once we know a restaurant serves a Chicken Cheese Burger,
 * an unhappy diner can tap "Burger was dry" — and the dashboard can finally answer
 * the question an owner actually has on Monday morning: which dish is the problem?
 *
 * ── Scope: the menu belongs to the ACCOUNT, not the location ──────────────────
 * `MenuItem` hangs off `Brand`, exactly like the logo (M26). A group enters its
 * menu once and every location uses it — which is also what lets the dashboard
 * compare one dish across branches ("the burger is fine in Dhanmondi, bad in
 * Gulshan"). A location-specific menu would make that comparison impossible.
 */

import { prisma } from "./prisma";

/** A dish as the settings UI and the chip lookup consume it. */
export interface MenuItemRecord {
  id: number;
  name: string;
  category: string | null;
  active: boolean;
  positiveChips: string[];
  negativeChips: string[];
  chipsSource: string;
}

/** Every dish still on the account's menu, alphabetically. */
export async function getMenu(brandId: number): Promise<MenuItemRecord[]> {
  const rows = await prisma.menuItem.findMany({
    where: { brandId, active: true },
    orderBy: { name: "asc" },
  });
  return rows.map(toRecord);
}

/** One dish still on the account's menu, or null. Scoped by brandId like `setChips`,
 *  so a forged id from another account finds nothing. */
export async function getDish(brandId: number, menuItemId: number): Promise<MenuItemRecord | null> {
  const row = await prisma.menuItem.findFirst({ where: { id: menuItemId, brandId, active: true } });
  return row ? toRecord(row) : null;
}

// NOTE: `getMenuIncludingInactive()` lived here to feed the dashboard's insights
// view, before that view was built on `Feedback.dishNames` snapshots instead —
// which is better, because it shows what a dish was called when the diner ate it
// and needs no join at all. It had no callers left, so it's gone rather than left
// to rot (the same call M22 and M31 made for their own dead lib functions).

function toRecord(row: {
  id: number;
  name: string;
  category: string | null;
  active: boolean;
  positiveChips: string[];
  negativeChips: string[];
  chipsSource: string;
}): MenuItemRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    active: row.active,
    positiveChips: row.positiveChips,
    negativeChips: row.negativeChips,
    chipsSource: row.chipsSource,
  };
}

/**
 * Replace the account's menu with `dishes`, in one transaction.
 *
 * ⚠️ Dishes that disappear are DEACTIVATED, never deleted. Feedback rows carry a
 * snapshot of the dish name they were about (`Feedback.dishNames`), so history
 * survives regardless — but keeping the row means the dashboard can still group
 * and label old feedback properly, and re-adding a dish later restores its chips
 * rather than starting from nothing.
 *
 * Existing dishes are matched by name and keep their chips, so re-saving a menu
 * never silently discards wording the owner has edited by hand.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ A HANDFUL OF QUERIES, WHATEVER THE MENU SIZE.                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * This used to send one query per dish, inside the transaction. Prisma cancels an
 * interactive transaction after 5 seconds, and each query is a round trip to the
 * database — ~65ms from a laptop, ~200ms from a server on the other side of the
 * world from the database. So a menu of ~75 dishes (or ~20 in production) blew the
 * limit, the whole save rolled back, and the owner got "Could not save the menu"
 * on every retry. Measured, not guessed — see the QA notes.
 *
 * Now the writes are grouped: one to switch dishes off, one to switch dishes back
 * on, one to create every new dish, plus one per category that actually changed
 * and one per dish whose capitals changed (both rare). A typical re-save is four
 * queries, and a brand-new 200-dish menu is three.
 *
 * ⚠️ MATCHING IGNORES CAPITALS. "chicken cheese burger" is the same dish as
 * "Chicken Cheese Burger" — the owner fixed a typo, they didn't add a dish. Matching
 * exactly used to create a second row and switch the first one off, so any wording
 * the owner had edited on it silently stopped being shown. The row is now kept and
 * simply renamed.
 */
export async function replaceMenu(
  brandId: number,
  dishes: { name: string; category: string | null }[]
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.menuItem.findMany({
        where: { brandId },
        select: { id: true, name: true, category: true, active: true, chipsSource: true },
      });

      // Group existing rows by name-ignoring-case. Normally one row per name, but a
      // menu saved before case-insensitive matching can hold "Burger" AND "burger".
      const byKey = new Map<string, typeof existing>();
      for (const row of existing) {
        const key = row.name.toLowerCase();
        byKey.set(key, [...(byKey.get(key) ?? []), row]);
      }

      const keep = new Set<number>();
      const create: { brandId: number; name: string; category: string | null }[] = [];
      const renames: { id: number; name: string }[] = [];
      const categoryChanges = new Map<string | null, number[]>();

      for (const dish of dishes) {
        const candidates = byKey.get(dish.name.toLowerCase()) ?? [];
        // Which existing row IS this dish? An exact match first (never needs a
        // rename, so it can't collide with the unique name index), then the one on
        // the menu now, then one the owner has personally edited.
        const row =
          candidates.find((c) => c.name === dish.name) ??
          candidates.find((c) => c.active) ??
          candidates.find((c) => c.chipsSource === "owner") ??
          candidates[0];

        if (!row) {
          create.push({ brandId, name: dish.name, category: dish.category });
          continue;
        }
        keep.add(row.id);
        if (row.name !== dish.name) renames.push({ id: row.id, name: dish.name });
        if (row.category !== dish.category) {
          categoryChanges.set(dish.category, [
            ...(categoryChanges.get(dish.category) ?? []),
            row.id,
          ]);
        }
      }

      // Anything not on the new list goes inactive (never deleted — see above).
      await tx.menuItem.updateMany({
        where: { brandId, active: true, id: { notIn: [...keep] } },
        data: { active: false },
      });

      // Dishes coming back onto the menu. Their chips are left alone — regenerating
      // them is a separate, explicit action.
      if (keep.size > 0) {
        await tx.menuItem.updateMany({
          where: { id: { in: [...keep] }, active: false },
          data: { active: true },
        });
      }

      for (const [category, ids] of categoryChanges) {
        await tx.menuItem.updateMany({ where: { id: { in: ids } }, data: { category } });
      }

      for (const { id, name } of renames) {
        await tx.menuItem.update({ where: { id }, data: { name } });
      }

      if (create.length > 0) {
        // skipDuplicates: if two saves of the same menu race, the second one's
        // creates are already there — that's not an error worth failing a save for.
        await tx.menuItem.createMany({ data: create, skipDuplicates: true });
      }
    },
    // Headroom, not a crutch: the work above is a few queries, but a database
    // waking from idle (Neon suspends when quiet) can take seconds to hand over a
    // connection, and that shouldn't cost an owner their menu.
    { maxWait: 10_000, timeout: 20_000 }
  );
}

/**
 * Store the chips for one dish.
 *
 * `source` records where they came from — "ai" when generated, "owner" once
 * someone has reworded them by hand. That distinction matters: a regenerate must
 * be able to leave the owner's own wording untouched.
 */
export async function setChips(
  menuItemId: number,
  brandId: number,
  chips: { positive: string[]; negative: string[] },
  source: "template" | "ai" | "owner"
): Promise<number> {
  // Scoped by brandId as well as id — the same defensive pattern as
  // `resolveFeedback` and `deleteTable`. A forged id from another account
  // matches zero rows and changes nothing.
  const result = await prisma.menuItem.updateMany({
    where: { id: menuItemId, brandId },
    data: {
      positiveChips: chips.positive,
      negativeChips: chips.negative,
      chipsSource: source,
    },
  });
  return result.count;
}

/**
 * Store chips for MANY dishes at once — the bulk version of `setChips`, used after a
 * menu save and by "Regenerate all".
 *
 * Calling `setChips` in a loop costs one database round trip per dish; for a 200-dish
 * menu on a server far from the database that's the best part of a minute. Instead:
 *
 *   • Dishes that get IDENTICAL chips share one query. Standard (template) chips are
 *     per category, so a whole menu usually needs only a query per category.
 *   • The remaining queries (AI chips are unique per dish) run a few at a time in
 *     parallel rather than one after another.
 *
 * Scoped by `brandId` like `setChips`, so a forged id matches nothing.
 */
export async function setChipsForMany(
  brandId: number,
  items: { id: number; chips: { positive: string[]; negative: string[] } }[],
  source: "template" | "ai"
): Promise<void> {
  const groups = new Map<string, { chips: (typeof items)[number]["chips"]; ids: number[] }>();
  for (const { id, chips } of items) {
    const key = JSON.stringify([chips.positive, chips.negative]);
    const group = groups.get(key);
    if (group) group.ids.push(id);
    else groups.set(key, { chips, ids: [id] });
  }

  const updates = [...groups.values()];
  // 8 at a time: well inside the connection pool, and enough to hide the latency.
  const PARALLEL = 8;
  for (let i = 0; i < updates.length; i += PARALLEL) {
    await Promise.all(
      updates.slice(i, i + PARALLEL).map(({ chips, ids }) =>
        prisma.menuItem.updateMany({
          where: { brandId, id: { in: ids } },
          data: {
            positiveChips: chips.positive,
            negativeChips: chips.negative,
            chipsSource: source,
          },
        })
      )
    );
  }
}

// NOTE: an `allChipsForBrand()` helper started here as the tag whitelist for
// `POST /api/feedback`, but the whitelist ended up in `acceptableChips()`
// (lib/chips-for-order.ts) instead — and deliberately so. Deriving it from the SAME
// ladder that decided what the diner was shown means the set can't drift from
// what was actually on their screen, which a separate "all chips" query could.
// One source of truth, so no unused second one.

/**
 * Which of this account's dishes appear in a list of item names from a till.
 *
 * A POS sends whatever its own menu calls things, and it won't always match ours
 * exactly — "Chicken Cheese Burger" vs "CHICKEN CHEESE BURGER (L)". So matching is
 * case-insensitive and accepts a containment match in either direction, which
 * handles size suffixes and modifiers without needing the owner to keep two menus
 * in perfect sync.
 *
 * Deliberately NOT fuzzy beyond that: guessing wrongly here puts the wrong dish's
 * chips in front of a diner, and a wrong tap becomes wrong data on the owner's
 * dashboard. No match simply falls back to menu-wide chips, which is always safe.
 *
 * ⚠️ An EXACT name always wins over a containment match. This used to take whichever
 * containment match came first, so on a menu with both "Latte" and "Iced Latte" a
 * plain Latte order could get the Iced Latte's chips ("iced latte" contains
 * "latte"). With a menu imported from Square the names are exactly the till's, so
 * the exact rung is what nearly every order hits.
 */
export function matchDishes(
  menu: MenuItemRecord[],
  itemNames: string[]
): MenuItemRecord[] {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const names = menu.map((m) => ({ item: m, name: norm(m.name) }));

  const matched: MenuItemRecord[] = [];
  for (const raw of itemNames) {
    const needle = norm(raw);
    if (!needle) continue;
    const hit =
      names.find((n) => n.name === needle)?.item ?? closestContaining(names, needle);
    if (hit && !matched.some((m) => m.id === hit.id)) matched.push(hit);
  }
  return matched;
}

/**
 * The containment match nearest in length to the till's name — so "Iced Latte (L)"
 * picks "Iced Latte" over "Latte", both of which it contains.
 */
function closestContaining(
  names: { item: MenuItemRecord; name: string }[],
  needle: string
): MenuItemRecord | undefined {
  let best: MenuItemRecord | undefined;
  let bestGap = Infinity;
  for (const { item, name } of names) {
    if (!needle.includes(name) && !name.includes(needle)) continue;
    const gap = Math.abs(name.length - needle.length);
    if (gap < bestGap) {
      best = item;
      bestGap = gap;
    }
  }
  return best;
}
