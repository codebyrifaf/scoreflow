/**
 * `POST /api/pos/orders` — a restaurant's till tells us what an order contained.
 *
 * This is the missing half of order-aware feedback. `Feedback.orderNumber` has
 * always been a string the DINER types, with nothing behind it, so the quick-tap
 * chips could only ever be generic. Now the till says "order 102 = chicken cheese
 * burger", and a diner who rates it 3/10 is offered "Burger was dry" — without
 * being asked a single extra question.
 *
 * ── This endpoint is PUBLIC and machine-called ───────────────────────────────
 * It has to be: a till isn't logged into anything. So it is authenticated the way
 * `GET /api/cron/digest` already is — a bearer token — except per-restaurant
 * rather than one global secret.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ THE RESTAURANT IS RESOLVED FROM THE KEY, NEVER FROM THE BODY.             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * The payload carries no restaurant id, slug, or name — nothing a caller could
 * use to claim to be someone else. Identity comes from a secret they had to be
 * given. This is the same rule that stops a diner attaching feedback to another
 * restaurant on `/api/feedback`.
 *
 * The owner-facing contract for this endpoint lives in docs/POS_INTEGRATION.md.
 * ⚠️ Change one and change the other — an integration guide that lies is worse
 * than none, because the developer trusts it over the error message.
 */

import { after } from "next/server";
import {
  restaurantForPosKey,
  recordPosOrder,
  countRecentOrders,
  pruneOldOrders,
} from "@/lib/pos-orders";

/** Input caps. Everything a stranger can send is bounded (the M17 rule). */
const MAX_ORDER_NUMBER_LENGTH = 32; // matches /api/feedback's own cap
const MAX_ITEMS = 50;
const MAX_ITEM_LENGTH = 80;

/**
 * Ceiling on how fast one restaurant's till may push orders. Set far above any
 * real service (a very busy kitchen is nowhere near 300/hour of *distinct*
 * orders), but low enough that a looping integration can't fill the table.
 */
const MAX_ORDERS_PER_HOUR = 600;

type OrderBody = {
  orderNumber?: unknown;
  items?: unknown;
  placedAt?: unknown;
};

export async function POST(request: Request) {
  // 1. Who is calling? A bearer token, hashed and looked up. Never the body.
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) {
    return Response.json(
      { error: "Missing Authorization: Bearer <key> header." },
      { status: 401 }
    );
  }

  const restaurant = await restaurantForPosKey(key);
  if (!restaurant) {
    // Deliberately identical to the missing-key case in shape: we never reveal
    // whether a key is merely wrong or belongs to a restaurant that exists.
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  // 2. Parse. Never assume the shape is what the docs asked for.
  let body: OrderBody;
  try {
    body = (await request.json()) as OrderBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  // 3. Validate. `orderNumber` is the receipt number the guest will type — the
  //    single most important field, and the one integrations most often get
  //    wrong by sending an internal id instead.
  if (typeof body.orderNumber !== "string" || body.orderNumber.trim() === "") {
    return Response.json(
      { error: "orderNumber is required (the number printed on the guest's receipt)." },
      { status: 400 }
    );
  }
  const orderNumber = body.orderNumber.trim();
  if (orderNumber.length > MAX_ORDER_NUMBER_LENGTH) {
    return Response.json(
      { error: `orderNumber must be ${MAX_ORDER_NUMBER_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json(
      { error: "items is required and must be a non-empty array of dish names." },
      { status: 400 }
    );
  }
  const items = (body.items as unknown[])
    .filter((i): i is string => typeof i === "string")
    .map((i) => i.trim().slice(0, MAX_ITEM_LENGTH))
    .filter((i) => i !== "")
    .slice(0, MAX_ITEMS);
  if (items.length === 0) {
    return Response.json(
      { error: "items contained no usable dish names." },
      { status: 400 }
    );
  }

  // Optional. A till that doesn't send it simply means "now".
  let placedAt = new Date();
  if (typeof body.placedAt === "string") {
    const parsed = new Date(body.placedAt);
    if (!Number.isNaN(parsed.getTime())) placedAt = parsed;
  }

  // 4. Rate limit, per restaurant. A misconfigured integration in a retry loop is
  //    far more likely than an attacker here — but either way it's their own
  //    table it would fill, and their own chips it would slow down.
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  if ((await countRecentOrders(restaurant.id, oneHourAgo)) >= MAX_ORDERS_PER_HOUR) {
    return Response.json(
      { error: "Too many orders received in the last hour. Please slow down." },
      { status: 429 }
    );
  }

  // 5. Store it. Upserts, so a till that retries doesn't duplicate the order.
  try {
    await recordPosOrder({
      restaurantId: restaurant.id,
      orderNumber,
      items,
      placedAt,
    });
  } catch (err) {
    console.error("[pos] failed to record order:", err);
    return Response.json(
      { error: "Could not record the order. Please retry." },
      { status: 500 }
    );
  }

  // 6. Housekeeping, after the response is sent. Orders past the retention window
  //    are never read, so the table would otherwise grow forever — the same
  //    fire-and-forget shape as `pruneOldAttempts()` on the login path. `after()`
  //    keeps it off the till's response time; a POS that waits on us is a POS
  //    that slows down a checkout.
  after(async () => {
    try {
      await pruneOldOrders();
    } catch {
      // Ignore — the order is safely stored; tidying can wait for the next one.
    }
  });

  return Response.json({ ok: true, orderNumber }, { status: 201 });
}
