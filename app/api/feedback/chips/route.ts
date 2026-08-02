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
import { countRecentByIpHash } from "@/lib/feedback";

/**
 * Lookups allowed per caller per minute. Generous — a diner legitimately triggers
 * one per rating change while making up their mind — but low enough that walking
 * every order number of a busy restaurant isn't practical.
 *
 * Reuses the feedback spam counter rather than adding a table: someone
 * enumerating orders is already bounded by how much feedback they can submit,
 * and a real diner is nowhere near either limit.
 */
const MAX_LOOKUPS_PER_MINUTE = 30;

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
    const ipHash = clientIpHash(request.headers);
    const recent = await countRecentByIpHash(ipHash, new Date(Date.now() - 60_000));
    if (recent >= MAX_LOOKUPS_PER_MINUTE) {
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
