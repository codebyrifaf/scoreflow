/**
 * Review-click tracking redirect — `GET /r/[slug]/go-review?f=<feedbackId>&p=<platform>`
 * (Milestone 24; extended to four platforms in M29).
 *
 * Each logo tile on the thank-you screen points here instead of straight at Google /
 * Tripadvisor / Yelp / Zomato. This route records that the diner tapped through — and
 * WHICH platform they chose — then forwards them on. Those stamps are what let the
 * owner's dashboard say "47 invited → 12 clicked, 9 of them Google", the number that
 * answers "what am I actually paying for?".
 *
 * ── Rule 1: never get between the diner and the review ───────────────────────
 * This is on the diner's happy path. If ANYTHING here is slow or fails — the id is
 * missing or forged, the tracking write errors — we still redirect them onward. The
 * worst case is a click we failed to count, never a diner who couldn't leave a review.
 *
 * ── Rule 2: never become an open redirect ────────────────────────────────────
 * ⚠️ This route performs a redirect to an owner-supplied URL, which makes it the most
 * dangerous line of code in the product. If that URL isn't validated, any owner can
 * point it at a phishing site and hand out a `scoreflow…/go-review` link that borrows
 * OUR domain's credibility (the M25 finding).
 *
 * The URL is already host-allowlisted when it's SAVED — but we re-check it HERE too,
 * because this is the thing that actually performs the redirect and it must never
 * trust a stored value (a legacy row, a bad migration, a future code path that forgets
 * to validate). Defence in depth: two independent checks, and the one at the point of
 * use is the one that counts.
 */

import { NextResponse } from "next/server";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { markReviewClicked } from "@/lib/feedback";
import { isValidReviewUrl } from "@/lib/review-url";
import { isReviewPlatform, reviewPlatform } from "@/lib/review-platforms";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);

  /** Send them back to the form rather than anywhere off-domain. The safe exit. */
  const backToFeedback = () =>
    NextResponse.redirect(new URL(`/r/${slug}/feedback`, request.url));

  let restaurant;
  try {
    restaurant = await getRestaurantBySlug(slug);
  } catch {
    restaurant = null;
  }
  if (!restaurant) return backToFeedback();

  // Which platform? Defaults to Google when `p` is absent, so any link minted before
  // M29 still works. An UNKNOWN value is not guessed at — it takes the safe exit,
  // because the alternative is resolving an unvalidated string and redirecting to it.
  const requested = url.searchParams.get("p") ?? "google";
  if (!isReviewPlatform(requested)) return backToFeedback();

  const def = reviewPlatform(requested);
  if (!def) return backToFeedback();

  const target = restaurant[def.field];

  // No link set, or a stored value that doesn't survive re-validation → back to the
  // form. NEVER redirect to an unvalidated string. See Rule 2 above.
  if (!target || !isValidReviewUrl(requested, target)) {
    return backToFeedback();
  }

  // Record the click, scoped to THIS restaurant so a forged id from another tenant
  // matches zero rows. Best-effort: a tracking failure must never block the diner.
  const feedbackId = Number(url.searchParams.get("f"));
  if (Number.isInteger(feedbackId) && feedbackId > 0) {
    try {
      await markReviewClicked(feedbackId, restaurant.id, requested);
    } catch (err) {
      console.error("[go-review] failed to record click:", err);
    }
  }

  // Onward. 302 (not permanent) — the target can change, and we want the tracking hop
  // to run on every tap rather than being cached away by the browser.
  return NextResponse.redirect(target, { status: 302 });
}
