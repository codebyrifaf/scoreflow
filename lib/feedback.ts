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
import { lastLocalDays, localDayKey, weekdayNarrow } from "./time";
import type {
  FeedbackPayload,
  FeedbackRecord,
  FeedbackStats,
  ReviewInviteStats,
  TrendDay,
} from "./types";

/**
 * ⚠️ DEPRECATED (Milestone 24). Loads EVERY feedback row for a restaurant. This was
 * the dashboard's data source, and on a busy venue it meant fetching thousands of
 * rows into memory on every page load. It has been replaced by the BOUNDED queries
 * below (`getFeedbackStats`, `getDailyTrend`, `getLowestRated`, `getRecentFeedback`,
 * `getTopTags`). Do not reach for this in new code.
 */
export async function getFeedbackForRestaurant(
  restaurantId: number,
  since?: Date
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: { restaurantId, ...(since ? { createdAt: { gte: since } } : {}) },
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
  contactName: string | null;
  contactPhone: string | null;
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
    contactName: row.contactName ?? "",
    contactPhone: row.contactPhone ?? "",
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    // The database stores a real Date; the rest of the app uses an ISO string.
    timestamp: row.createdAt.toISOString(),
  };
}

// ── Bounded dashboard queries (Milestone 24) ────────────────────────────────
//
// Each of these is bounded — an aggregate (no rows in memory), or a `take`-limited
// slice — so the dashboard's cost no longer grows with a restaurant's history. All
// use the `[restaurantId, createdAt]` index from M17.

/**
 * The window's total responses + average rating, computed in SQL.
 * `since` (inclusive) and `until` (exclusive) bound the window; omit both for all
 * time. `until` is what lets the dashboard measure the PREVIOUS period for its
 * "vs previous" delta ([prevStart, since)).
 */
export async function getFeedbackStats(
  restaurantId: number,
  since?: Date,
  until?: Date
): Promise<FeedbackStats> {
  const createdAt =
    since || until
      ? { ...(since ? { gte: since } : {}), ...(until ? { lt: until } : {}) }
      : undefined;
  const agg = await prisma.feedback.aggregate({
    where: { restaurantId, ...(createdAt ? { createdAt } : {}) },
    _count: { _all: true },
    _avg: { rating: true },
  });
  return { total: agg._count._all, average: agg._avg.rating };
}

/**
 * The 7-day daily-average trend, bucketed by LOCAL (Europe/London) day — so
 * "yesterday" is a real local day, not a UTC one (Milestone 24 timezone fix).
 * Loads only the last 7 local days of rows, never the whole history.
 */
export async function getDailyTrend(
  restaurantId: number,
  now: Date = new Date()
): Promise<TrendDay[]> {
  const days = lastLocalDays(7, now);
  const rows = await prisma.feedback.findMany({
    where: { restaurantId, createdAt: { gte: days[0].start } },
    select: { rating: true, createdAt: true },
  });

  // Sum + count per local day.
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const key = localDayKey(r.createdAt);
    const cur = byDay.get(key) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    byDay.set(key, cur);
  }

  return days.map((d) => {
    const agg = byDay.get(d.key);
    return {
      label: weekdayNarrow(d.date),
      avg: agg && agg.count > 0 ? agg.sum / agg.count : null,
      count: agg?.count ?? 0,
    };
  });
}

/** The lowest-rated orders in the window (worst first). Bounded by `take`. */
export async function getLowestRated(
  restaurantId: number,
  since: Date | undefined,
  take = 5
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: { restaurantId, ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(toRecord);
}

/** The most recent submissions in the window. Bounded by `take` (pagination). */
export async function getRecentFeedback(
  restaurantId: number,
  since: Date | undefined,
  take = 50
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: { restaurantId, ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toRecord);
}

/**
 * Top quick-tap "mentions" in the window. Counted over the most recent `sample`
 * submissions rather than the entire history — bounded, and representative enough
 * for what is a directional "what keeps coming up?" signal, not exact accounting.
 */
export async function getTopTags(
  restaurantId: number,
  since: Date | undefined,
  sample = 500
): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.feedback.findMany({
    where: { restaurantId, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { tags: true },
    orderBy: { createdAt: "desc" },
    take: sample,
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const tag of r.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));
}

/**
 * Review-invite ROI (Milestone 24): of the diners who submitted (and were therefore
 * shown the Google invite), how many actually tapped through.
 *
 * `invited` is the number of submissions in the window — every diner is shown the
 * same invite when a review URL is set, so submissions ≈ invitations. `clicked` is
 * those with `reviewClickedAt` stamped. The dashboard only surfaces this when a
 * review URL is actually set, so "invited" is meaningful.
 */
export async function getReviewInviteStats(
  restaurantId: number,
  since?: Date
): Promise<ReviewInviteStats> {
  const where = { restaurantId, ...(since ? { createdAt: { gte: since } } : {}) };
  const [invited, clicked] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { ...where, reviewClickedAt: { not: null } } }),
  ]);
  return { invited, clicked };
}

/**
 * Stamp that THIS diner tapped through to Google (Milestone 24). Called by the
 * `/r/<slug>/go-review` redirect.
 *
 * SECURITY: `id` comes from a public URL, so it's scoped to `restaurantId` (a
 * forged id from another tenant matches nothing), and `reviewClickedAt: null` means
 * we count each diner's click at most once. Best-effort — the redirect never waits
 * on or fails because of this.
 */
export async function markReviewClicked(
  id: number,
  restaurantId: number
): Promise<void> {
  await prisma.feedback.updateMany({
    where: { id, restaurantId, reviewClickedAt: null },
    data: { reviewClickedAt: new Date() },
  });
}

/**
 * The "Needs attention" worklist (Milestone 18): this restaurant's STILL-OPEN
 * complaints — a rating at or below `alertThreshold` that nobody has dealt with —
 * newest first.
 *
 * This is what makes a notification into a workflow. The owner sees the unhappy
 * diners waiting on them, not just a red dot.
 *
 * ⚠️ BOUNDED (`take`). It wasn't: M24 put a ceiling on every other dashboard query
 * and missed this one, so a restaurant that stopped working its queue (or got
 * review-bombed — M17 permits up to 300 submissions/hour) would load EVERY open
 * complaint into memory and render a card, with its own form and action binding, for
 * each. The dashboard would get slower precisely when the owner most needs it. The
 * true total comes from `countOpenComplaints` so the badge never lies about how many
 * are really waiting.
 */
export async function getOpenComplaints(
  restaurantId: number,
  alertThreshold: number,
  take = 25
): Promise<FeedbackRecord[]> {
  const rows = await prisma.feedback.findMany({
    where: {
      restaurantId, // ← the isolation boundary, as always
      rating: { lte: alertThreshold },
      resolvedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toRecord);
}

/**
 * How many complaints are REALLY still open (a COUNT in SQL — no rows loaded).
 * Pairs with the bounded `getOpenComplaints` above so the dashboard can show the
 * honest total ("14") while only rendering the first page of cards.
 */
export async function countOpenComplaints(
  restaurantId: number,
  alertThreshold: number
): Promise<number> {
  return prisma.feedback.count({
    where: { restaurantId, rating: { lte: alertThreshold }, resolvedAt: null },
  });
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
 * Save one new feedback submission for ONE restaurant, and RETURN its id
 * (Milestone 24 — the thank-you screen needs the id to build a review link that
 * we can attribute a click back to).
 *
 * `restaurantId` is resolved server-side from the URL slug (never trusted from
 * the browser). `createdAt` is filled in automatically by the database default.
 */
export async function createFeedback(
  restaurantId: number,
  input: FeedbackPayload,
  ipHash?: string | null
): Promise<number> {
  const row = await prisma.feedback.create({
    data: {
      restaurantId,
      table: input.table,
      orderNumber: input.orderNumber,
      rating: input.rating,
      comment: input.comment,
      tags: input.tags,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      ipHash: ipHash ?? null,
    },
    select: { id: true },
  });
  return row.id;
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
