/**
 * Table data access (Milestone 8) — the one place that reads/writes table rows.
 *
 * A "table" is a physical table in a restaurant that gets an NFC chip. Every
 * function here is **scoped to a single restaurant** via `restaurantId`, exactly
 * like lib/feedback.ts — that scoping is what stops one owner from touching
 * another restaurant's tables.
 */

import { prisma } from "./prisma";

/** All tables for ONE restaurant, oldest first. */
export async function getTablesForRestaurant(restaurantId: number) {
  return prisma.table.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
  });
}

/** Add a table to ONE restaurant. `label` is unique per restaurant (DB enforces). */
export async function createTable(restaurantId: number, label: string) {
  return prisma.table.create({
    data: { restaurantId, label },
  });
}

/**
 * Delete a table — but ONLY if it belongs to `restaurantId`.
 *
 * We use `deleteMany` with BOTH the id and the restaurantId in the filter, so an
 * owner can never delete another restaurant's table by guessing an id: if the id
 * belongs to a different restaurant, zero rows match and nothing is deleted.
 * Returns the Prisma batch result (`{ count }`).
 */
export async function deleteTable(restaurantId: number, tableId: number) {
  return prisma.table.deleteMany({
    where: { id: tableId, restaurantId },
  });
}
