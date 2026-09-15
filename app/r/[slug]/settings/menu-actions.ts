"use server";

/**
 * Owner actions for the MENU and the POS connection.
 *
 * ── Security, the same two rules as everywhere else in this codebase ─────────
 *   1. `requireDashboardAccess(slug)` decides IF you may touch this restaurant.
 *      It already encodes the M16/M17 rules and re-reads the database rather than
 *      trusting the session, so we inherit all of that for free.
 *   2. **`isAccountOwner` on top of it.** The menu belongs to the ACCOUNT, not the
 *      location — one menu is shared by every branch (like the M26 logo). A branch
 *      manager must not be able to rewrite the whole group's menu, any more than
 *      they can change its logo.
 */

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { getDish, getMenu, replaceMenu, setChips, setChipsForMany } from "@/lib/menu";
import { aiIsConfigured, extractMenu, generateChips, type ExtractedDish } from "@/lib/ai";
import { rotatePosKey, clearPosKey } from "@/lib/pos-orders";
import { disconnectSquare, linkSquareLocation, readSquareMenuForBrand } from "@/lib/square";
import { guessDishCategory } from "@/lib/feedback-chips";

/** Bounds on what an owner can submit. Generous, but not unbounded. */
const MAX_DISHES = 200;
const MAX_DISH_NAME = 80;
/** Same cap and reasoning as the M26 logo: a client-supplied image, bounded. */
const MAX_PHOTO_CHARS = 600 * 1024;

export type MenuState =
  | { ok: true; message: string; warning?: string }
  | { error: string }
  | undefined;

/**
 * Guard shared by every action here: you may touch this restaurant AND you own
 * the account it belongs to.
 *
 * An explicit discriminated union rather than an inferred one — `ok` is the tag,
 * so every caller narrows cleanly with `if (!guard.ok)` and there's no chance of a
 * branch accidentally reading a field the other variant doesn't have.
 */
type AccountGuard =
  | { ok: false; error: string }
  | { ok: true; restaurantId: number; brandId: number };

async function requireAccount(slug: string): Promise<AccountGuard> {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return { ok: false, error: "You are not authorized to do this." };
  }
  // The menu and the till belong to the ACCOUNT, and one menu is shared by every
  // location — so a branch manager must not be able to rewrite the whole group's,
  // exactly as they can't change its logo (M26).
  if (!access.isAccountOwner) {
    // Worded for all three things this guards — the menu, the till key and Square.
    return { ok: false, error: "Only the account owner can change this." };
  }
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant?.brandId) {
    return { ok: false, error: "This restaurant isn't part of an account yet." };
  }
  return { ok: true, restaurantId: restaurant.id, brandId: restaurant.brandId };
}

/**
 * Read a photographed menu into a dish list.
 *
 * Returns the dishes for the owner to REVIEW — it deliberately does not save.
 * A model misreading a menu is expected, not exceptional, so the owner always
 * sees and confirms what was extracted before it becomes their menu.
 */
export async function extractMenuPhoto(
  slug: string,
  dataUrl: string
): Promise<
  { dishes: ExtractedDish[]; warning?: string } | { error: string }
> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  // The image is client-supplied, so it's validated here exactly as the M26 logo
  // is: base64 only, a strict MIME allowlist, and a size cap. SVG is rejected —
  // it can carry script, and we are about to hand this to a third party.
  if (dataUrl.length > MAX_PHOTO_CHARS) {
    return { error: "That photo is too large — try a smaller or more compressed image." };
  }
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) {
    return { error: "Please upload a PNG, JPG or WebP photo." };
  }

  const result = await extractMenu(dataUrl);
  if (result.data.length === 0) {
    return {
      error:
        result.warning ??
        "We couldn't find any dishes in that photo. Try a clearer picture, or type your menu instead.",
    };
  }
  return { dishes: result.data, warning: result.warning };
}

/**
 * Read the menu from the owner's SQUARE item list into the review box.
 *
 * Like a menu photo, this deliberately does NOT save: Square lists often hold things
 * that aren't dishes (bag charges, deposits, merchandise), so the owner reviews the
 * list and saves it themselves — the same review-then-save path as the photo, so the
 * two can't behave differently.
 *
 * The names come straight from Square, which is the point: they are the SAME names
 * Square prints on each order, so every order matches its dishes exactly — no typos,
 * no "Chicken Burger" vs "Chicken Cheese Burger".
 */
export async function importSquareMenu(
  slug: string
): Promise<{ dishes: ExtractedDish[]; note: string } | { error: string }> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  let items;
  try {
    items = await readSquareMenuForBrand(guard.brandId);
  } catch (err) {
    console.error("[square] reading the item list failed:", (err as Error).message);
    return { error: "Couldn't read your Square item list just now. Please try again." };
  }
  if (items === null) {
    return { error: "Connect Square first — it's below, under “Connect your till”." };
  }
  if (items.length === 0) {
    return {
      error:
        "Your Square item list has no food or drink in it yet. Add your items in Square, or type your menu below.",
    };
  }

  const dishes = items.slice(0, MAX_DISHES).map((i) => {
    const name = i.name.replace(/\s+/g, " ").trim().slice(0, MAX_DISH_NAME);
    let category = guessDishCategory(name, i.squareCategories);
    // The review box reads "Name, category" — so a Square name like "Fish, chips"
    // would come back from Save as the dish "Fish" in category "chips". Giving it a
    // category keeps the LAST comma as the separator and the name whole.
    if (!category && looksLikeCategoryTail(name)) category = "other";
    return { name, category };
  });
  const more = items.length - dishes.length;
  return {
    dishes,
    note:
      `Found ${dishes.length} item${dishes.length === 1 ? "" : "s"} in Square` +
      (more > 0 ? ` (the first ${MAX_DISHES} of ${items.length})` : "") +
      ". Remove anything that isn't food — like bag charges — then save.",
  };
}

/**
 * Save the menu, then generate chips for it.
 *
 * The dish list arrives as text — one per line, optionally `Name, category` —
 * which is what BOTH entry paths produce: the review table after a photo, and the
 * type/paste box. One parser, one save path, so the two can't behave differently.
 */
export async function saveMenu(
  slug: string,
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  const raw = String(formData.get("dishes") ?? "");
  const { dishes, dropped } = parseDishes(raw);
  if (dishes.length === 0) {
    return { error: "Add at least one dish, one per line." };
  }

  try {
    await replaceMenu(guard.brandId, dishes);
  } catch (err) {
    // ⚠️ LOGGED, not just swallowed. This catch used to discard the error, so when
    // large menus were failing (a transaction timeout — see replaceMenu) nothing
    // at all appeared in the server logs. The owner still gets a friendly message;
    // whoever is on call can now see why.
    console.error("[menu] save failed:", err);
    return { error: "Could not save the menu. Please try again." };
  }

  // Chips are generated HERE, once, and stored on each dish — never on the
  // diner's path. This is the whole reason a diner's form stays instant.
  const warnings: string[] = [];
  if (dropped > 0) {
    // Said out loud: a menu cut short with only "Saved 200 dishes." to show for it
    // would look like success while the last dishes quietly went missing.
    warnings.push(
      `Only the first ${MAX_DISHES} dishes were saved — ${dropped} more ${
        dropped === 1 ? "was" : "were"
      } left off. ScoreFlow keeps up to ${MAX_DISHES} dishes per menu.`
    );
  }
  try {
    const generated = await generateChips(dishes);
    // AI switched on but not answering: the standard suggestions are a stopgap for
    // NEW dishes only (they must show guests something). Existing dishes keep what
    // they have rather than being downgraded to generic ones by an unrelated save.
    const aiDown = aiIsConfigured() && generated.source !== "ai";
    if (aiDown) {
      warnings.push(
        "We couldn't reach the AI service, so any new dishes got standard suggestions for now — " +
          "press Regenerate all in a minute to replace them. Your other dishes kept theirs."
      );
    } else if (generated.warning) {
      warnings.push(generated.warning);
    }
    await storeGeneratedChips(guard.brandId, generated, { onlyNewDishes: aiDown });
  } catch (err) {
    // The menu itself is saved; chips can be regenerated. Never fail the save.
    console.error("[menu] chip generation failed after save:", err);
    warnings.push("Your menu was saved, but we couldn't generate suggestions. Try Regenerate.");
  }

  revalidatePath(`/r/${slug}/settings`);
  revalidatePath(`/r/${slug}/dashboard`);
  return {
    ok: true,
    message: `Saved ${dishes.length} dish${dishes.length === 1 ? "" : "es"}.`,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

/**
 * Write freshly generated chips onto the saved menu, in bulk.
 *
 * Shared by `saveMenu` and `regenerateChips` so the two can't drift. Dishes the owner
 * has reworded by hand are skipped — they know their food better than any model.
 * Returns how many dishes were `updated` and how many were `kept` as the owner wrote
 * them, so "Regenerate all" can say what it actually did.
 *
 * `onlyNewDishes`: touch only dishes with no suggestions yet (used when the AI is down
 * and `generated` is the standard fallback).
 */
async function storeGeneratedChips(
  brandId: number,
  generated: Awaited<ReturnType<typeof generateChips>>,
  { onlyNewDishes = false }: { onlyNewDishes?: boolean } = {}
): Promise<{ updated: number; kept: number }> {
  const menu = await getMenu(brandId);
  const kept = menu.filter((item) => item.chipsSource === "owner").length;
  const items = menu
    .filter((item) => item.chipsSource !== "owner")
    .filter((item) => !onlyNewDishes || (item.positiveChips.length === 0 && item.negativeChips.length === 0))
    .flatMap((item) => {
      const chips = generated.data.get(item.name);
      return chips ? [{ id: item.id, chips }] : [];
    });
  await setChipsForMany(brandId, items, generated.source);
  return { updated: items.length, kept };
}

/**
 * Re-run chip generation for the whole menu, respecting owner edits.
 *
 * Takes only `slug`: it needs neither the previous state nor any form field, and a
 * function with fewer parameters is still a valid `useActionState` action. Declaring
 * unused ones just to match the signature adds lint noise for nothing (the call M34
 * made for the same reason).
 */
export async function regenerateChips(slug: string): Promise<MenuState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  const menu = await getMenu(guard.brandId);
  if (menu.length === 0) return { error: "Add some dishes first." };

  // ⚠️ This used to answer "Suggestions regenerated." even when it had skipped EVERY
  // dish (all edited by the owner) — a success message for nothing done. It now says
  // exactly what happened, and doesn't call the AI at all when there's nothing to do.
  const editable = menu.filter((m) => m.chipsSource !== "owner");
  if (editable.length === 0) {
    return {
      error:
        `Nothing was regenerated: you've edited ${menu.length === 1 ? "this dish" : `all ${menu.length} dishes`} ` +
        "yourself, and Regenerate never replaces your own wording. To start a dish afresh, " +
        "press “Replace with fresh suggestions” under it.",
    };
  }

  let generated: Awaited<ReturnType<typeof generateChips>>;
  let counts: { updated: number; kept: number };
  try {
    generated = await generateChips(editable.map((m) => ({ name: m.name, category: m.category })));
    // AI switched on but unreachable (Gemini's free tier does have demand spikes):
    // generateChips falls back to the standard suggestions — right for a NEW dish,
    // which must have some, but here it would swap the owner's good AI suggestions
    // for generic ones. Keep what they have and say so.
    if (aiIsConfigured() && generated.source !== "ai") return { error: AI_UNREACHABLE };
    counts = await storeGeneratedChips(guard.brandId, generated);
  } catch (err) {
    console.error("[menu] regenerate failed:", err);
    return { error: "Could not regenerate suggestions. Please try again." };
  }

  revalidatePath(`/r/${slug}/settings`);
  const done = generated.source === "ai" ? "Suggestions regenerated" : "Standard suggestions applied";
  const n = counts.updated;
  return {
    ok: true,
    message:
      counts.kept === 0
        ? `${done}.`
        : `${done} for ${n} dish${n === 1 ? "" : "es"}. ` +
          `${counts.kept} you edited ${counts.kept === 1 ? "was" : "were"} left as you wrote ${counts.kept === 1 ? "it" : "them"}.`,
  };
}

/** Said when the AI is switched on but didn't answer — and so nothing was changed. */
const AI_UNREACHABLE =
  "Couldn't reach the AI just now, so nothing was changed. Please try again in a minute.";

/**
 * Save one dish's chips after the owner has edited them.
 *
 * Marks the dish `"owner"`, which is what stops a later regenerate overwriting
 * wording they chose deliberately. They know their food better than any model.
 *
 * ⚠️ Only when something actually CHANGED. Pressing Save on an untouched dish used to
 * mark it "edited by you" too — so an owner who tidily pressed every Save button had
 * silently locked their whole menu out of "Regenerate all", with no way back.
 */
export async function saveDishChips(
  slug: string,
  menuItemId: number,
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  const parse = (v: FormDataEntryValue | null) =>
    String(v ?? "")
      .split("\n")
      .map((s) => s.trim().slice(0, 28))
      .filter(Boolean)
      .slice(0, 6);
  const next = { positive: parse(formData.get("positive")), negative: parse(formData.get("negative")) };

  // Scoped by brandId — a forged id from another account finds nothing.
  const dish = await getDish(guard.brandId, menuItemId);
  if (!dish) return { error: "That dish isn't on your menu." };

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (same(next.positive, dish.positiveChips) && same(next.negative, dish.negativeChips)) {
    return { ok: true, message: "No changes to save." };
  }

  const updated = await setChips(menuItemId, guard.brandId, next, "owner");
  if (updated === 0) return { error: "That dish isn't on your menu." };

  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, message: "Suggestions updated." };
}

/**
 * Throw away the owner's wording for ONE dish and write fresh suggestions — the way
 * back from "edited by you", which "Regenerate all" deliberately never touches.
 * Fresh from the AI when it's switched on, the standard ones when it isn't.
 */
export async function resetDishChips(slug: string, menuItemId: number): Promise<MenuState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  const dish = await getDish(guard.brandId, menuItemId);
  if (!dish) return { error: "That dish isn't on your menu." };

  let source: "template" | "ai";
  try {
    // Never throws for AI trouble — it falls back to the standard suggestions.
    const generated = await generateChips([{ name: dish.name, category: dish.category }]);
    // …but with the AI switched on and not answering, that fallback would swap the
    // owner's own wording for generic suggestions they never asked for. Change nothing.
    if (aiIsConfigured() && generated.source !== "ai") return { error: AI_UNREACHABLE };
    const chips = generated.data.get(dish.name)!;
    await setChips(dish.id, guard.brandId, chips, generated.source);
    source = generated.source;
  } catch (err) {
    console.error("[menu] resetting one dish's suggestions failed:", err);
    return { error: "Could not get fresh suggestions. Please try again." };
  }

  revalidatePath(`/r/${slug}/settings`);
  return {
    ok: true,
    message: source === "ai" ? "Fresh suggestions added." : "Standard suggestions put back.",
  };
}

// ── POS connection ───────────────────────────────────────────────────────────

export type PosKeyState =
  | { ok: true; key: string }
  | { ok: true; cleared: true }
  | { error: string }
  | undefined;

/**
 * Mint a new POS key. The plaintext is returned ONCE and never again — only its
 * hash is stored, so we genuinely cannot show it a second time.
 *
 * Regenerating immediately invalidates the old key, which is the point: it's the
 * lever an owner pulls when a key has leaked.
 */
export async function generateKey(slug: string): Promise<PosKeyState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  try {
    const key = await rotatePosKey(guard.restaurantId);
    revalidatePath(`/r/${slug}/settings`);
    return { ok: true, key };
  } catch {
    return { error: "Could not generate a key. Please try again." };
  }
}

/** Disconnect the till. The existing key stops working immediately. */
export async function disconnectPos(slug: string): Promise<PosKeyState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  try {
    await clearPosKey(guard.restaurantId);
  } catch (err) {
    console.error("[pos] disconnect failed:", err);
    return { error: "Could not disconnect the till. Please try again." };
  }
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, cleared: true };
}

// ── Square ───────────────────────────────────────────────────────────────────
//
// Connecting happens in the /api/square/oauth routes (it's a trip to Square and
// back, which a server action can't make). Once connected, these two manage it.

export type SquareState = { ok: true; message: string } | { error: string } | undefined;

/** Link THIS branch to one of the business's Square locations, or unlink it. */
export async function setSquareLocation(
  slug: string,
  _prev: SquareState,
  formData: FormData
): Promise<SquareState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };

  const locationId = String(formData.get("locationId") ?? "").trim() || null;
  try {
    const result = await linkSquareLocation(guard.brandId, guard.restaurantId, locationId);
    if ("error" in result) return result;
  } catch (err) {
    console.error("[square] linking a location failed:", (err as Error).message);
    return { error: "Couldn't reach Square just now. Please try again." };
  }
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, message: locationId ? "Location linked." : "Location unlinked." };
}

/** Disconnect the whole account from Square (every branch's link goes with it). */
export async function disconnectSquareAccount(slug: string): Promise<SquareState> {
  const guard = await requireAccount(slug);
  if (!guard.ok) return { error: guard.error };
  try {
    await disconnectSquare(guard.brandId);
  } catch (err) {
    console.error("[square] disconnect failed:", (err as Error).message);
    return { error: "Could not disconnect Square. Please try again." };
  }
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, message: "Square disconnected." };
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/** Would the text after this line's last comma be read as a category? */
function looksLikeCategoryTail(line: string): boolean {
  const comma = line.lastIndexOf(",");
  if (comma <= 0) return false;
  const tail = line.slice(comma + 1).trim();
  return tail.length > 0 && tail.length <= 20 && !tail.includes(" ");
}

/**
 * `"Chicken Cheese Burger, burger"` → `{ name, category }`.
 *
 * One dish per line; an optional category after a comma. Forgiving on purpose —
 * this is typed by a restaurant owner on a phone, not a data-entry operator.
 *
 * Returns how many dishes were `dropped` for being over MAX_DISHES, so the caller
 * can tell the owner rather than letting the end of their menu vanish silently.
 */
function parseDishes(raw: string): { dishes: ExtractedDish[]; dropped: number } {
  const out: ExtractedDish[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const comma = trimmed.lastIndexOf(",");
    let name = trimmed;
    let category: string | null = null;
    // Only treat it as a category if it looks like one — a dish legitimately
    // containing a comma ("Rice, Dal and Salad") must not lose half its name.
    if (looksLikeCategoryTail(trimmed)) {
      name = trimmed.slice(0, comma).trim();
      category = trimmed.slice(comma + 1).trim().toLowerCase();
    }

    name = name.replace(/\s+/g, " ").slice(0, MAX_DISH_NAME);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Keep counting past the cap (duplicates excluded) so the warning is exact.
    if (out.length >= MAX_DISHES) {
      dropped++;
      continue;
    }
    out.push({ name, category });
  }

  return { dishes: out, dropped };
}
