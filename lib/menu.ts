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
 */
export async function replaceMenu(
  brandId: number,
  dishes: { name: string; category: string | null }[]
): Promise<void> {
  const wanted = new Map(dishes.map((d) => [d.name, d]));

  await prisma.$transaction(async (tx) => {
    const existing = await tx.menuItem.findMany({ where: { brandId } });
    const existingByName = new Map(existing.map((m) => [m.name, m]));

    // Anything no longer on the list goes inactive (never deleted — see above).
    const goneIds = existing
      .filter((m) => m.active && !wanted.has(m.name))
      .map((m) => m.id);
    if (goneIds.length > 0) {
      await tx.menuItem.updateMany({
        where: { id: { in: goneIds } },
        data: { active: false },
      });
    }

    for (const dish of wanted.values()) {
      const current = existingByName.get(dish.name);
      if (current) {
        // Reactivate and refresh the category, but leave the chips alone —
        // regenerating them is a separate, explicit action.
        await tx.menuItem.update({
          where: { id: current.id },
          data: { active: true, category: dish.category },
        });
      } else {
        await tx.menuItem.create({
          data: { brandId, name: dish.name, category: dish.category },
        });
      }
    }
  });
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
 */
export function matchDishes(
  menu: MenuItemRecord[],
  itemNames: string[]
): MenuItemRecord[] {
  const matched: MenuItemRecord[] = [];
  for (const raw of itemNames) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    const hit = menu.find((m) => {
      const name = m.name.toLowerCase();
      return name === needle || needle.includes(name) || name.includes(needle);
    });
    if (hit && !matched.some((m) => m.id === hit.id)) matched.push(hit);
  }
  return matched;
}
