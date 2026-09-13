/**
 * `GET /api/feedback/chips` — the quick-tap options for one diner.
 *
 * The feedback form calls this once the diner has typed an order number and
 * picked a rating. If their till told us what order 102 was, they get chips about
 * the dish they actually ate; otherwise they get this restaurant's menu-wide
 * chips; otherwise the original generic six. The ladder lives in
 * lib/chips-for-order.ts and is shared with `POST /api/feedback`, so what the
 * diner is offered and what the API will accept can never drift apart.
 *
 * ⚠️ ON THE DINER'S PATH. Indexed database reads only — no AI, no third-party
 * call, nothing that can hang. Chips were generated when the owner saved their
 * menu; this only looks them up.
 *
 * ⚠️ FAILS OPEN, DELIBERATELY. Any error at all returns the generic chips with a
 * 200. A diner standing at a table must never see a broken form because a lookup
 * failed — the worst acceptable outcome is chips that are less specific than they
 * could have been. This is the same instinct as `/go-review`, which forwards the
 * diner onward even when its own tracking write fails.
 *
 * ── This endpoint is PUBLIC ──────────────────────────────────────────────────
 * Like `/api/feedback`, it has to be — a diner isn't logged in. It reveals what
 * an order contained to anyone who guesses its number. That is low-sensitivity
 * (the guest is holding the receipt), but it IS enumerable, so it's rate-limited
 * per caller and degrades to generic chips rather than erroring when throttled.
 */

import { getRestaurantBySlug } from "@/lib/restaurants";
import { resolveChips } from "@/lib/chips-for-order";
import { chipsForRating } from "@/lib/feedback-chips";
import { clientIpHash } from "@/lib/request-ip";

/**
 * Lookups allowed per caller per minute.
 *
 * A diner makes a handful (the form waits for them to stop typing, then asks once per
 * rating they try). Sixty leaves room for a whole table sharing restaurant wifi — one
 * public IP — while making it slow to walk through a restaurant's order numbers.
 */
const MAX_LOOKUPS_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

/**
 * ⚠️ THE OLD LIMIT NEVER FIRED. It counted this caller's FEEDBACK SUBMISSIONS in the
 * last minute and called them "lookups". Someone reading order contents never
 * submits anything, so their count stayed at zero: QA made 40 lookups in a row and
 * every one was answered. The comment promised a protection the code didn't give.
 *
 * This counts the lookups themselves, in memory, per server instance.
 *
 * WHY MEMORY AND NOT THE DATABASE. A database counter would be airtight across every
 * server, but it would add a write to every lookup — and this endpoint's design rule
 * is "indexed reads only", because a diner is standing at a table waiting for it.
 * The trade-off, stated honestly: a caller whose requests spread across several warm
 * server instances gets up to this limit on EACH. That still turns "read every order,
 * instantly" into slow work, for data that's low-sensitivity (the dishes on a recent
 * order, deleted after 24h). If that ever stops being enough, the answer is a
 * `ChipLookup` table in the style of `LoginAttempt` — not a bigger number here.
 */
const lookups = new Map<string, number[]>();

function overLimit(ipHash: string, now = Date.now()): boolean {
  const recent = (lookups.get(ipHash) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  lookups.set(ipHash, recent);

  // Forget callers who've gone quiet, so the map can't grow without bound.
  if (lookups.size > 5_000) {
    for (const [key, times] of lookups) {
      if (now - times[times.length - 1] >= WINDOW_MS) lookups.delete(key);
    }
  }
  return recent.length > MAX_LOOKUPS_PER_MINUTE;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const orderNumber = (url.searchParams.get("order") ?? "").slice(0, 32);
  const rating = Number(url.searchParams.get("rating"));

  // A rating is required — it decides which band of chips to show. Anything
  // outside 1–10 is a malformed call, not a diner.
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return Response.json({ chips: [], matched: false }, { status: 400 });
  }

  try {
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      // Unknown slug reveals nothing and still returns something usable.
      return Response.json({ chips: chipsForRating(rating), matched: false });
    }

    // Throttled callers get generic chips, not an error. A rate limit must never
    // be the reason a real diner sees a broken form.
    if (overLimit(clientIpHash(request.headers))) {
      return Response.json({
        chips: chipsForRating(rating, restaurant.positiveThreshold),
        matched: false,
      });
    }

    const resolved = await resolveChips({
      restaurantId: restaurant.id,
      brandId: restaurant.brandId,
      orderNumber,
      rating,
      positiveThreshold: restaurant.positiveThreshold,
    });

    return Response.json({
      chips: resolved.chips,
      matched: resolved.matched,
    });
  } catch (err) {
    console.error("[chips] lookup failed:", err);
    // See the header note: fail open, always with something tappable.
    return Response.json({ chips: chipsForRating(rating), matched: false });
  }
}
