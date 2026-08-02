/**
 * Which chips does THIS diner see? — the fallback ladder, in one place.
 *
 * Two callers need the identical answer and must never disagree:
 *   • `GET /api/feedback/chips` — what the form shows the diner;
 *   • `POST /api/feedback`      — the whitelist of tags it will accept.
 *
 * If those two ever drifted, a diner could tap a chip the API then rejected — the
 * feedback would save with the tag silently dropped, and the owner's "Top
 * mentions" would be quietly wrong. One function, both callers.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ THE LADDER — every rung degrades to something usable, never to nothing.   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 *   1. Order matched  → the chips for the dishes they actually ate
 *   2. Menu, no match → chips drawn from the account's menu generally
 *   3. No menu at all → the original generic six (lib/feedback-chips.ts)
 *
 * Rung 3 is what every restaurant on the platform sees today, so a restaurant
 * that never connects a till or uploads a menu is no worse off than before. That
 * matters: this feature must be an upgrade for the restaurants that adopt it and
 * a no-op for everyone else, not a regression that punishes the unprepared.
 *
 * ⚠️ NO AI RUNS HERE. Chips were generated when the owner saved their menu and
 * live on the `MenuItem` row. This path is pure indexed database reads, because
 * it runs while a diner is standing at a table waiting for a form.
 */

import "server-only";
import { chipsForRating } from "./feedback-chips";
import { getMenu, matchDishes, type MenuItemRecord } from "./menu";
import { findOrderItems } from "./pos-orders";

/** How many chips the diner is shown. More than this is a wall, not a choice. */
const MAX_SHOWN = 8;

export interface ResolvedChips {
  chips: string[];
  /** True when we matched a real order — the dish-specific case. */
  matched: boolean;
  /** The dish names we matched, for `Feedback.dishNames`. Empty when unmatched. */
  dishNames: string[];
}

/**
 * The chips for one diner, given what they typed and how they rated.
 *
 * `rating` decides which band: at or above the restaurant's `positiveThreshold`
 * we ask what they loved, below it what could be better. That's the same rule
 * `chipsForRating` has always used — M18 unified it so the question a diner is
 * asked always matches the screen they land on.
 */
export async function resolveChips(input: {
  restaurantId: number;
  brandId: number | null;
  orderNumber: string;
  rating: number;
  positiveThreshold: number;
}): Promise<ResolvedChips> {
  const { restaurantId, brandId, orderNumber, rating, positiveThreshold } = input;
  const positive = rating >= positiveThreshold;

  // Rung 3 up front: whatever happens below, we always have these to fall back on.
  const generic = chipsForRating(rating, positiveThreshold);

  // A restaurant with no account (a legacy standalone) has no menu to draw on.
  if (!brandId) return { chips: generic, matched: false, dishNames: [] };

  const menu = await getMenu(brandId);
  if (menu.length === 0) return { chips: generic, matched: false, dishNames: [] };

  // ── Rung 1: did their till tell us what this order was? ───────────────────
  if (orderNumber.trim()) {
    const items = await findOrderItems(restaurantId, orderNumber);
    if (items && items.length > 0) {
      const dishes = matchDishes(menu, items);
      if (dishes.length > 0) {
        return {
          chips: dishChips(dishes, positive, generic),
          matched: true,
          dishNames: dishes.map((d) => d.name),
        };
      }
    }
  }

  // ── Rung 2: no order match, but we know what this restaurant serves ───────
  return {
    chips: menuWideChips(menu, positive, generic),
    matched: false,
    dishNames: [],
  };
}

/**
 * Chips for the specific dishes a diner ate.
 *
 * With several dishes we interleave rather than concatenate, so a two-course
 * order doesn't show six burger chips and none for the dessert. The generic
 * chips are appended last as filler — a diner's complaint may be about the
 * service rather than the food, and that option shouldn't disappear just because
 * we now know what they ordered.
 */
function dishChips(
  dishes: MenuItemRecord[],
  positive: boolean,
  generic: string[]
): string[] {
  const lists = dishes.map((d) =>
    (positive ? d.positiveChips : d.negativeChips).map((c) => label(d, c, dishes.length))
  );

  const out: string[] = [];
  for (let i = 0; out.length < MAX_SHOWN; i++) {
    let added = false;
    for (const list of lists) {
      if (i < list.length && out.length < MAX_SHOWN) {
        out.push(list[i]);
        added = true;
      }
    }
    if (!added) break;
  }

  return fill(out, generic);
}

/**
 * Prefix a chip with its dish when the order had more than one, so "Dry" is not
 * ambiguous between the burger and the cake. With a single dish the context is
 * obvious and the prefix would just be noise on a small screen.
 */
function label(dish: MenuItemRecord, chip: string, dishCount: number): string {
  return dishCount > 1 ? `${dish.name} — ${chip}` : chip;
}

/**
 * Chips when we don't know the order: one per dish, across the menu.
 *
 * Still far better than generic — "Burger dry" and "Coffee weak" at least name
 * this restaurant's own food, so a diner can recognise their complaint instead of
 * squeezing it into "Food was cold".
 */
function menuWideChips(
  menu: MenuItemRecord[],
  positive: boolean,
  generic: string[]
): string[] {
  const out: string[] = [];
  for (const dish of menu) {
    const [first] = positive ? dish.positiveChips : dish.negativeChips;
    if (first) out.push(`${dish.name} — ${first}`);
    if (out.length >= MAX_SHOWN - 2) break; // leave room for the generic filler
  }
  return fill(out, generic);
}

/** Top up to MAX_SHOWN with generic chips, skipping anything already present. */
function fill(out: string[], generic: string[]): string[] {
  const seen = new Set(out.map((c) => c.toLowerCase()));
  for (const g of generic) {
    if (out.length >= MAX_SHOWN) break;
    if (seen.has(g.toLowerCase())) continue;
    seen.add(g.toLowerCase());
    out.push(g);
  }
  return out;
}

/**
 * Every chip this restaurant could legitimately show anyone, in either band.
 *
 * ⚠️ THIS IS THE SECURITY BOUNDARY for `POST /api/feedback`. Before M17 that
 * endpoint accepted any string as a tag, which let an attacker write their own
 * text straight into the owner's "Top mentions" panel. Making chips per-dish
 * makes the whitelist dynamic — but it stays a CLOSED SET, derived on the server
 * from the same data the diner was shown. It must never become "accept whatever
 * the client sends".
 *
 * Built by asking the ladder for both bands and both match outcomes, so anything
 * a diner could actually have tapped is included and nothing else is.
 */
export async function acceptableChips(input: {
  restaurantId: number;
  brandId: number | null;
  orderNumber: string;
  positiveThreshold: number;
}): Promise<{ allowed: Set<string>; dishNames: string[] }> {
  const { positiveThreshold } = input;
  const allowed = new Set<string>();
  let dishNames: string[] = [];

  // BOTH bands, because a diner can change their rating after tapping a chip. The
  // set stays closed either way — a chip from the other band is still one of this
  // restaurant's own, which is all the whitelist is asserting.
  const belowBand = Math.max(1, positiveThreshold - 1);
  for (const rating of [positiveThreshold, belowBand]) {
    const resolved = await resolveChips({ ...input, rating });
    for (const c of resolved.chips) allowed.add(c);
    // Same order either way — take it once, for `Feedback.dishNames`.
    if (resolved.dishNames.length > 0) dishNames = resolved.dishNames;
  }

  return { allowed, dishNames };
}
