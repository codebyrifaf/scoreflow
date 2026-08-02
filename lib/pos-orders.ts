/**
 * Orders pushed by a restaurant's till, and the key that authenticates them.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * `Feedback.orderNumber` is a string the DINER types. Nothing in ScoreFlow has
 * ever known what was in it — which is why the quick-tap chips could only ever be
 * generic. AI can't bridge that gap either: order numbers are arbitrary, reset
 * daily, and mean different things at every restaurant, so asking a model "what's
 * in order 102?" returns a guess. A wrong guess is worse than no data — it sends
 * an owner to fix a kitchen station that was never broken.
 *
 * So the link has to come from the restaurant's own system. Their till POSTs each
 * order here as it's rung up; we hold it just long enough for the diner to submit
 * feedback, and match on the number they type.
 */

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/** How far back we look when matching a diner's order number. */
export const ORDER_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * How long an order is kept before the sweep removes it.
 *
 * Deliberately short. We only ever read the last few hours, so retaining a
 * restaurant's full order history would be holding their commercial data for no
 * product benefit — and it's data a diner never consented to us storing either.
 */
export const ORDER_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── The per-restaurant key ───────────────────────────────────────────────────

/** Human-recognisable prefix, so a key is obviously a ScoreFlow POS key. */
const KEY_PREFIX = "sk_pos_";

/**
 * SHA-256 of a presented key. What we store and what we look up by.
 *
 * ⚠️ We never store the key itself. A leak of this database therefore can't be
 * used to inject fake orders into a customer's account — the same reasoning
 * behind hashing OTPs in lib/verification.ts. It's also why `Restaurant.posKeyHash`
 * is `@unique`: authenticating an incoming request is one indexed lookup, not a
 * scan across every restaurant.
 *
 * Unlike a password this isn't bcrypt-hashed. A POS key is 32 bytes of
 * cryptographic randomness, not something a human chose, so there is no dictionary
 * to attack and nothing for a slow hash to buy us — while a per-request bcrypt on
 * a hot ingestion endpoint would be real cost.
 */
export function hashPosKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** A fresh key, plus the pieces we persist. Shown to the owner exactly once. */
export function generatePosKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  const key = KEY_PREFIX + randomBytes(24).toString("hex");
  return {
    key,
    hash: hashPosKey(key),
    // Enough to recognise which key is live, far too little to reconstruct it.
    prefix: key.slice(0, KEY_PREFIX.length + 4) + "…",
  };
}

/** Mint (or replace) a restaurant's key. The plaintext is returned ONCE. */
export async function rotatePosKey(restaurantId: number): Promise<string> {
  const { key, hash, prefix } = generatePosKey();
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { posKeyHash: hash, posKeyPrefix: prefix },
  });
  return key;
}

/** Disconnect a till: the old key stops working immediately. */
export async function clearPosKey(restaurantId: number): Promise<void> {
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { posKeyHash: null, posKeyPrefix: null },
  });
}

/**
 * Which restaurant does this key belong to? `null` if none.
 *
 * ⚠️ THE RESTAURANT IS RESOLVED FROM THE KEY, NEVER FROM THE REQUEST BODY. This is
 * the same rule that stops a diner claiming to be a different restaurant on
 * `/api/feedback`: identity comes from something the caller had to be given, not
 * from something they typed.
 */
export async function restaurantForPosKey(
  key: string
): Promise<{ id: number; slug: string } | null> {
  if (!key) return null;
  const restaurant = await prisma.restaurant.findUnique({
    where: { posKeyHash: hashPosKey(key) },
    select: { id: true, slug: true },
  });
  return restaurant;
}

// ── Orders ───────────────────────────────────────────────────────────────────

/**
 * Record one order from a till.
 *
 * Upserts on (restaurant, order number, placedAt) so a POS that retries — or
 * re-sends an order after items were added — updates the existing row rather than
 * creating a duplicate. Integrations retry; the endpoint has to be safe when they do.
 */
export async function recordPosOrder(input: {
  restaurantId: number;
  orderNumber: string;
  items: string[];
  placedAt: Date;
}): Promise<void> {
  const { restaurantId, orderNumber, items, placedAt } = input;
  await prisma.posOrder.upsert({
    where: {
      restaurantId_orderNumber_placedAt: { restaurantId, orderNumber, placedAt },
    },
    update: { items },
    create: { restaurantId, orderNumber, items, placedAt },
  });
}

/**
 * The items in this restaurant's order `orderNumber`, if the till told us about it
 * recently. `null` when there's no match — which is a normal, expected state (no
 * till connected, a mistyped number, an order older than the window).
 *
 * Scoped by `restaurantId`, like every other read in this codebase: one restaurant
 * can never see another's orders. Newest first, because order numbers repeat once
 * the till's counter rolls over.
 */
export async function findOrderItems(
  restaurantId: number,
  orderNumber: string,
  now: Date = new Date()
): Promise<string[] | null> {
  const trimmed = orderNumber.trim();
  if (!trimmed) return null;

  const order = await prisma.posOrder.findFirst({
    where: {
      restaurantId,
      orderNumber: trimmed,
      createdAt: { gte: new Date(now.getTime() - ORDER_MATCH_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { items: true },
  });
  return order?.items ?? null;
}

/** When this restaurant's till last sent us anything — drives the "it's working"
 *  indicator in Settings, which is how a non-technical owner can tell the
 *  integration is alive without understanding any of it. */
export async function lastOrderReceivedAt(
  restaurantId: number
): Promise<Date | null> {
  const row = await prisma.posOrder.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** How many orders this restaurant's till has sent recently — the rate-limit input. */
export async function countRecentOrders(
  restaurantId: number,
  since: Date
): Promise<number> {
  return prisma.posOrder.count({
    where: { restaurantId, createdAt: { gte: since } },
  });
}

/**
 * Delete orders past the retention window. Best-effort, called opportunistically
 * from the ingestion path — the same fire-and-forget shape as
 * `pruneOldAttempts()` in lib/login-attempts.ts. Nothing outside the match window
 * is ever read, so this table would otherwise grow forever.
 */
export async function pruneOldOrders(): Promise<void> {
  await prisma.posOrder.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - ORDER_RETENTION_MS) } },
  });
}
