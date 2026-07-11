/**
 * Feedback data access — the one place that reads and writes feedback rows.
 *
 * Every function here is **scoped to a single restaurant** via `restaurantId`.
 * That scoping is the heart of multi-tenancy: because reads always filter by
 * `restaurantId` and writes always set it, one restaurant can never see or touch
 * another's feedback.
 *
 * (Milestone 4 moved this file here from app/feedback/store.ts and added the
 *  restaurant scoping. Callers resolve a slug → restaurant first, then pass the
 *  restaurant's numeric id to these functions.)
 */

import { prisma } from "./prisma";
import type { FeedbackPayload, FeedbackRecord } from "./types";

/**
 * Read feedback for ONE restaurant, oldest first.
 *
 * The `where: { restaurantId }` filter is the isolation boundary — the dashboard
 * for a given restaurant only ever gets that restaurant's rows. We translate each
 * database row into the `FeedbackRecord` shape the dashboard expects (its
 * `createdAt` Date becomes an ISO `timestamp` string).
 *
 * `since` (Milestone 9) optionally limits results to submissions on/after that
 * moment — used by the dashboard's Today / This week / This month filters. Omit
 * it to get all feedback.
 */
export async function getFeedbackForRestaurant(
  restaurantId: number,
  since?: Date
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: {
      restaurantId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    table: row.table,
    orderNumber: row.orderNumber,
    rating: row.rating,
    comment: row.comment,
    tags: row.tags,
    // The database stores a real Date; the rest of the app uses an ISO string.
    timestamp: row.createdAt.toISOString(),
  }));
}

/**
 * Save one new feedback submission for ONE restaurant.
 *
 * `restaurantId` is resolved server-side from the URL slug (never trusted from
 * the browser). `createdAt` is filled in automatically by the database default.
 */
export async function createFeedback(
  restaurantId: number,
  input: FeedbackPayload,
  ipHash?: string | null
): Promise<void> {
  await prisma.feedback.create({
    data: {
      restaurantId,
      table: input.table,
      orderNumber: input.orderNumber,
      rating: input.rating,
      comment: input.comment,
      tags: input.tags,
      ipHash: ipHash ?? null,
    },
  });
}

/**
 * Spam guard (Milestone 13): how many submissions this hashed IP has made since
 * `since`. Used to rate-limit the public feedback API.
 */
export async function countRecentByIpHash(
  ipHash: string,
  since: Date
): Promise<number> {
  return prisma.feedback.count({
    where: { ipHash, createdAt: { gte: since } },
  });
}

/**
 * Spam guard (Milestone 13): has this exact order number already been submitted
 * for this restaurant since `since`? Blocks accidental double-submits and trivial
 * repeat-spam of the same order.
 */
export async function hasRecentDuplicate(
  restaurantId: number,
  orderNumber: string,
  since: Date
): Promise<boolean> {
  const n = await prisma.feedback.count({
    where: { restaurantId, orderNumber, createdAt: { gte: since } },
  });
  return n > 0;
}
