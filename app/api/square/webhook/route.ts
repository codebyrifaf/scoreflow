/**
 * `POST /api/square/webhook` — where Square announces orders (Square integration,
 * step 2). Registered once, in Square's Developer Console, for every business that
 * connects; `merchant_id` in each event says which one it's about.
 *
 * Answers, and why each one:
 *   401 — signature missing or wrong. Nothing is read or written. (The body is read
 *         as RAW text first: the signature covers the exact bytes, so parsing and
 *         re-serialising the JSON would break a genuine one.)
 *   200 — handled, or deliberately ignored (a business or location we don't serve,
 *         an event type we don't use). Square stops retrying — correctly.
 *   500 — something transient failed (Square's API or our database). Square
 *         retries, which is exactly what we want: the order isn't lost.
 */

import { after } from "next/server";
import { handleSquareEvent, verifySquareSignature } from "@/lib/square-webhooks";
import { pruneOldOrders } from "@/lib/pos-orders";

export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifySquareSignature(raw, request.headers.get("x-square-hmacsha256-signature"))) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: Parameters<typeof handleSquareEvent>[0];
  try {
    event = JSON.parse(raw);
  } catch {
    // Signed but unparseable can't happen with Square; answer 200 so a freak
    // delivery isn't retried forever.
    return Response.json({ ok: false, outcome: "ignored:malformed" });
  }

  try {
    const outcome = await handleSquareEvent(event);
    // Housekeeping after the response, the same as the key route: orders past the
    // retention window are never read again.
    after(async () => {
      try {
        await pruneOldOrders();
      } catch {
        // The order is stored; tidying can wait for the next one.
      }
    });
    return Response.json({ ok: true, outcome });
  } catch (err) {
    // Logged without the payload — it names a real business's order.
    console.error("[square] webhook failed, Square will retry:", (err as Error).message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
