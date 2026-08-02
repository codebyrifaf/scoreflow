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
import { getMenu, replaceMenu, setChips } from "@/lib/menu";
import { extractMenu, generateChips, type ExtractedDish } from "@/lib/ai";
import { rotatePosKey, clearPosKey } from "@/lib/pos-orders";

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
    return { ok: false, error: "Only the account owner can change the menu." };
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
  const dishes = parseDishes(raw);
  if (dishes.length === 0) {
    return { error: "Add at least one dish, one per line." };
  }

  try {
    await replaceMenu(guard.brandId, dishes);
  } catch {
    return { error: "Could not save the menu. Please try again." };
  }

  // Chips are generated HERE, once, and stored on each dish — never on the
  // diner's path. This is the whole reason a diner's form stays instant.
  let warning: string | undefined;
  try {
    const generated = await generateChips(dishes);
    warning = generated.warning;
    const saved = await getMenu(guard.brandId);
    for (const item of saved) {
      // Never overwrite wording the owner has edited by hand.
      if (item.chipsSource === "owner") continue;
      const chips = generated.data.get(item.name);
      if (chips) {
        await setChips(item.id, guard.brandId, chips, generated.source);
      }
    }
  } catch (err) {
    // The menu itself is saved; chips can be regenerated. Never fail the save.
    console.error("[menu] chip generation failed after save:", err);
    warning = "Your menu was saved, but we couldn't generate suggestions. Try Regenerate.";
  }

  revalidatePath(`/r/${slug}/settings`);
  revalidatePath(`/r/${slug}/dashboard`);
  return {
    ok: true,
    message: `Saved ${dishes.length} dish${dishes.length === 1 ? "" : "es"}.`,
    warning,
  };
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

  const generated = await generateChips(
    menu.map((m) => ({ name: m.name, category: m.category }))
  );
  for (const item of menu) {
    if (item.chipsSource === "owner") continue;
    const chips = generated.data.get(item.name);
    if (chips) await setChips(item.id, guard.brandId, chips, generated.source);
  }

  revalidatePath(`/r/${slug}/settings`);
  return {
    ok: true,
    message:
      generated.source === "ai"
        ? "Suggestions regenerated."
        : "Standard suggestions applied.",
    warning: generated.warning,
  };
}

/**
 * Save one dish's chips after the owner has edited them.
 *
 * Marks the dish `"owner"`, which is what stops a later regenerate overwriting
 * wording they chose deliberately. They know their food better than any model.
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

  // Scoped by brandId inside `setChips` — a forged id from another account
  // matches zero rows.
  const updated = await setChips(
    menuItemId,
    guard.brandId,
    { positive: parse(formData.get("positive")), negative: parse(formData.get("negative")) },
    "owner"
  );
  if (updated === 0) return { error: "That dish isn't on your menu." };

  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, message: "Suggestions updated." };
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

  await clearPosKey(guard.restaurantId);
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true, cleared: true };
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * `"Chicken Cheese Burger, burger"` → `{ name, category }`.
 *
 * One dish per line; an optional category after a comma. Forgiving on purpose —
 * this is typed by a restaurant owner on a phone, not a data-entry operator.
 */
function parseDishes(raw: string): ExtractedDish[] {
  const out: ExtractedDish[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const comma = trimmed.lastIndexOf(",");
    let name = trimmed;
    let category: string | null = null;
    if (comma > 0) {
      const maybeCategory = trimmed.slice(comma + 1).trim().toLowerCase();
      // Only treat it as a category if it looks like one — a dish legitimately
      // containing a comma ("Rice, Dal and Salad") must not lose half its name.
      if (maybeCategory && maybeCategory.length <= 20 && !maybeCategory.includes(" ")) {
        name = trimmed.slice(0, comma).trim();
        category = maybeCategory;
      }
    }

    name = name.replace(/\s+/g, " ").slice(0, MAX_DISH_NAME);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category });
    if (out.length >= MAX_DISHES) break;
  }

  return out;
}
