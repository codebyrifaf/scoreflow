"use server";

/**
 * Server actions for the owner's Tables page (Milestone 8): add and remove tables.
 *
 * Both actions take the restaurant `slug` (bound in the client) and re-check that
 * the caller is the OWNER of that restaurant via `requireDashboardAccess` — the
 * same guard the dashboard uses. Never trust that the UI was only shown to owners.
 */

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import {
  getTablesForRestaurant,
  createTable,
  deleteTable,
} from "@/lib/tables";

/** What the add-table form reads back: an error, a success flag, or nothing yet. */
export type AddTableState = { error: string } | { ok: true } | undefined;

/**
 * Add a table. Bound in the client as `addTable.bind(null, slug)`, so
 * `useActionState` calls it with (prevState, formData).
 */
export async function addTable(
  slug: string,
  _prevState: AddTableState,
  formData: FormData
): Promise<AddTableState> {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return { error: "You are not authorized to manage this restaurant's tables." };
  }

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Please enter a table name or number." };
  if (label.length > 30) {
    return { error: "Table name is too long (max 30 characters)." };
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return { error: "Restaurant not found." };

  // Friendly duplicate check (the DB compound-unique index is the real backstop).
  const existing = await getTablesForRestaurant(restaurant.id);
  if (existing.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
    return { error: `You already have a table called “${label}”.` };
  }

  try {
    await createTable(restaurant.id, label);
  } catch {
    return { error: "Could not add that table — it may already exist." };
  }

  revalidatePath(`/r/${slug}/tables`);
  return { ok: true };
}

/**
 * Remove a table. Bound in the client as `removeTable.bind(null, slug, tableId)`
 * and used directly as a `<form action={…}>`. The delete is scoped to the owner's
 * restaurant, so it can never remove another restaurant's table.
 */
export async function removeTable(slug: string, tableId: number) {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) return;

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return;

  await deleteTable(restaurant.id, tableId);
  revalidatePath(`/r/${slug}/tables`);
}
