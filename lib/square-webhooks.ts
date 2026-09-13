/**
 * Square → ScoreFlow orders (Square integration, step 2).
 *
 * When a guest's order is rung up (and again when it's paid), Square sends a
 * webhook to /api/square/webhook. This file decides whether to believe it, which
 * branch it belongs to, and what to store.
 *
 * ── The rules ────────────────────────────────────────────────────────────────
 *   1. NOTHING is done for an unsigned or mis-signed message. The signature is
 *      checked first, in constant time, before any database work (Square's own
 *      warning: a timing difference can leak the key).
 *   2. The BRANCH comes from our own data — the connection that owns the business,
 *      then the branch linked to that location within that SAME account. Nothing in
 *      the message body can steer an order into a different account.
 *   3. The ORDER is fetched from Square rather than trusted from the message. The
 *      message doesn't contain the dishes anyway (Square's order webhooks are thin),
 *      and fetching means we always store the order as it is now.
 *
 * Signature details, verified against Square's docs (Sept 2026): header
 * `x-square-hmacsha256-signature` = base64(HMAC-SHA256(signature key,
 * notification URL + raw body)).
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { appUrl } from "./app-url";
import { normaliseOrderRef } from "./pos-orders";
import {
  fetchSquareOrder,
  squareAccessToken,
  squareEnvironment,
  type SquareOrder,
} from "./square";

// ── Is this really Square? ───────────────────────────────────────────────────

/**
 * The notification URL exactly as registered in Square's Developer Console. It's
 * part of what Square signs, so it must match character for character.
 *
 * Configured, not read from the request: behind a tunnel (development) or a proxy,
 * the request this server sees says "localhost", not the public address Square
 * actually called.
 */
export function squareWebhookUrl(): string {
  return process.env.SQUARE_WEBHOOK_URL || `${appUrl()}/api/square/webhook`;
}

export function verifySquareSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key).update(squareWebhookUrl() + rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── What to store ────────────────────────────────────────────────────────────

/**
 * A kitchen ticket name is only a match key if it looks like a NUMBER a guest was
 * handed ("42", "A17") — not a staff-typed name ("Sam"), a table ("Table 4") or
 * Square's literal default "Order". Short, and containing a digit.
 */
function ticketKey(ticketName: string | undefined): string | null {
  const t = ticketName?.trim();
  return t && t.length <= 8 && /\d/.test(t) ? t : null;
}

/**
 * Save (or refresh) one Square order against a branch.
 *
 * `orderNumber` — what Settings and any logs show — is the first receipt code once
 * the order is paid. Before payment there's no receipt yet, so it holds the ticket
 * number if any, else Square's order id; the row is still useful (the dishes are
 * known), and the payment's update fills in the receipt code on the SAME row.
 */
export async function recordSquareOrder(
  restaurantId: number,
  order: SquareOrder
): Promise<"saved" | "no-items"> {
  const items = (order.line_items ?? [])
    .map((li) => li.name?.trim() ?? "")
    .filter(Boolean);
  if (items.length === 0) return "no-items"; // an empty ticket — nothing to match to

  // Every payment's receipt code — a split bill gives each guest their own receipt,
  // and each of them should find this order.
  const receiptCodes = (order.tenders ?? [])
    .map((t) => t.id?.slice(0, 4) ?? "")
    .filter((c) => c.length === 4);
  const ticket = ticketKey(order.ticket_name);
  const matchKeys = [...new Set([...receiptCodes, ...(ticket ? [ticket] : [])].map(normaliseOrderRef))];
  const orderNumber = receiptCodes[0] ?? ticket ?? order.id;

  await prisma.posOrder.upsert({
    where: { restaurantId_externalId: { restaurantId, externalId: order.id } },
    create: {
      restaurantId,
      source: "square",
      externalId: order.id,
      orderNumber,
      items,
      placedAt: new Date(order.created_at),
      matchKeys,
    },
    update: { orderNumber, items, matchKeys },
  });
  return "saved";
}

// ── Handling one event ───────────────────────────────────────────────────────

type SquareEvent = {
  merchant_id?: string;
  type?: string;
  event_id?: string;
  data?: {
    id?: string;
    object?: Record<string, { order_id?: string; location_id?: string } | undefined>;
  };
};

/**
 * What happened to one (already signature-checked) event. Every "ignored" outcome
 * is a normal, permanent state — the route answers 200 so Square stops retrying.
 * Anything that THROWS is transient (Square or the database unreachable); the route
 * answers 500 and Square retries later.
 */
export type EventOutcome =
  | "saved"
  | "disconnected"
  | "ignored:event-type"
  | "ignored:not-connected"
  | "ignored:location-not-linked"
  | "ignored:no-items"
  | "ignored:malformed";

export async function handleSquareEvent(event: SquareEvent): Promise<EventOutcome> {
  const merchantId = event.merchant_id;
  if (!merchantId || !event.type) return "ignored:malformed";

  // The owner revoked ScoreFlow's access from Square's side. The tokens are dead
  // already; forget them and every location link, so Settings tells the truth.
  if (event.type === "oauth.authorization.revoked") {
    const conn = await prisma.squareConnection.findUnique({ where: { merchantId } });
    if (!conn) return "ignored:not-connected";
    await prisma.$transaction([
      prisma.restaurant.updateMany({ where: { brandId: conn.brandId }, data: { squareLocationId: null } }),
      prisma.squareConnection.delete({ where: { merchantId } }),
    ]);
    return "disconnected";
  }

  if (event.type !== "order.created" && event.type !== "order.updated") {
    return "ignored:event-type";
  }

  const detail = event.data?.object?.order_created ?? event.data?.object?.order_updated;
  const orderId = detail?.order_id ?? event.data?.id;
  const locationId = detail?.location_id;
  if (!orderId || !locationId) return "ignored:malformed";

  // Rule 2: the branch comes from OUR data. The business must be connected to an
  // account (in this environment), and the location linked to a branch of THAT
  // account.
  const conn = await prisma.squareConnection.findUnique({ where: { merchantId } });
  if (!conn || conn.environment !== squareEnvironment()) return "ignored:not-connected";
  const branch = await prisma.restaurant.findFirst({
    where: { squareLocationId: locationId, brandId: conn.brandId },
    select: { id: true },
  });
  if (!branch) return "ignored:location-not-linked";

  // Rule 3: fetch the order itself.
  const token = await squareAccessToken(conn.brandId);
  if (!token) return "ignored:not-connected";
  const order = await fetchSquareOrder(token, orderId);

  // Belt and braces: the fetched order must really be at that location.
  if (order.location_id !== locationId) return "ignored:malformed";

  const result = await recordSquareOrder(branch.id, order);
  return result === "saved" ? "saved" : "ignored:no-items";
}
