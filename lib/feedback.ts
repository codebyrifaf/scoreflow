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

  return rows.map(toRecord);
}

/** One database row → the `FeedbackRecord` shape the dashboard renders. */
function toRecord(row: {
  id: number;
  table: string | null;
  orderNumber: string;
  rating: number;
  comment: string;
  tags: string[];
  resolvedAt: Date | null;
  createdAt: Date;
}): FeedbackRecord {
  return {
    id: row.id,
    table: row.table,
    orderNumber: row.orderNumber,
    rating: row.rating,
    comment: row.comment,
    tags: row.tags,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    // The database stores a real Date; the rest of the app uses an ISO string.
    timestamp: row.createdAt.toISOString(),
  };
}

/**
 * The "Needs attention" worklist (Milestone 18): this restaurant's STILL-OPEN
 * complaints — a rating at or below `alertThreshold` that nobody has dealt with —
 * newest first.
 *
 * This is what makes a notification into a workflow. The owner sees the unhappy
 * diners waiting on them, not just a red dot.
 */
export async function getOpenComplaints(
  restaurantId: number,
  alertThreshold: number
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: {
      restaurantId, // ← the isolation boundary, as always
      rating: { lte: alertThreshold },
      resolvedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

/**
 * Mark one complaint as dealt with (Milestone 18).
 *
 * ⚠️ SECURITY: `id` comes from the BROWSER (it's a button on a list), so this must
 * never be trusted on its own. We scope the write with `updateMany` filtered by
 * BOTH the id AND the restaurantId — so an owner who guesses or forges another
 * tenant's feedback id simply matches zero rows and changes nothing. This is the
 * same defensive pattern as `deleteTable` in lib/tables.ts.
 *
 * Returns how many rows were actually updated (0 = not yours, or already closed).
 */
export async function resolveFeedback(
  id: number,
  restaurantId: number,
  resolvedBy: string
): Promise<number> {
  const result = await prisma.feedback.updateMany({
    where: { id, restaurantId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedBy },
  });
  return result.count;
}

/** Re-open a complaint that was closed by mistake. Scoped the same way. */
export async function reopenFeedback(
  id: number,
  restaurantId: number
): Promise<number> {
  const result = await prisma.feedback.updateMany({
    where: { id, restaurantId },
    data: { resolvedAt: null, resolvedBy: null },
  });
  return result.count;
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
 * Spam guard, layer 2 (Milestone 17): how many submissions THIS RESTAURANT has
 * received since `since` — from anyone.
 *
 * Why this exists on top of the per-IP limit: the per-IP limit can be defeated by
 * rotating IPs (a botnet, or open proxies). This one can't be, because it doesn't
 * look at who's calling at all. It's a hard ceiling on how fast a single
 * restaurant's dashboard can fill up, which is the thing we actually want to
 * protect — nobody gets to bury a paying customer's feedback under a flood of
 * fake 1-stars.
 *
 * Uses the new `[restaurantId, createdAt]` index (M17).
 */
export async function countRecentForRestaurant(
  restaurantId: number,
  since: Date
): Promise<number> {
  return prisma.feedback.count({
    where: { restaurantId, createdAt: { gte: since } },
  });
}

// ── Alerting (Milestone 18) ─────────────────────────────────────────────────

/**
 * Complaints for this restaurant that nobody has been emailed about yet.
 *
 * `since` guards against a nasty edge case: a brand-new alert setup (or a
 * restaurant whose `alertThreshold` was just raised) would otherwise sweep up
 * YEARS of old low ratings and email them all at once. We only ever alert on
 * genuinely recent feedback.
 */
export async function getUnalertedComplaints(
  restaurantId: number,
  alertThreshold: number,
  since: Date
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: {
      restaurantId,
      rating: { lte: alertThreshold },
      alertedAt: null,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

/**
 * When did we last send an alert about this restaurant? Drives the cooldown that
 * BATCHES alerts (see lib/notifications.ts) — without it, a burst of 1-star spam
 * would fire one email per submission and the owner would mute us forever.
 */
export async function lastAlertAtFor(restaurantId: number): Promise<Date | null> {
  const result = await prisma.feedback.aggregate({
    where: { restaurantId },
    _max: { alertedAt: true },
  });
  return result._max.alertedAt ?? null;
}

/** Stamp these rows as "included in an alert", so we never report a diner twice. */
export async function markAlerted(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.feedback.updateMany({
    where: { id: { in: ids } },
    data: { alertedAt: new Date() },
  });
}

/**
 * The daily digest's numbers for ONE restaurant (Milestone 18): how many
 * complaints came in over the window, and how many are STILL open.
 */
export async function complaintSummaryFor(
  restaurantId: number,
  alertThreshold: number,
  since: Date
): Promise<{ newComplaints: number; stillOpen: number; avgRating: number | null }> {
  const [newComplaints, stillOpen, agg] = await Promise.all([
    prisma.feedback.count({
      where: { restaurantId, rating: { lte: alertThreshold }, createdAt: { gte: since } },
    }),
    prisma.feedback.count({
      where: { restaurantId, rating: { lte: alertThreshold }, resolvedAt: null },
    }),
    prisma.feedback.aggregate({
      where: { restaurantId, createdAt: { gte: since } },
      _avg: { rating: true },
    }),
  ]);
  return { newComplaints, stillOpen, avgRating: agg._avg.rating };
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
