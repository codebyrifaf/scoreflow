/**
 * Review-click tracking redirect — `GET /r/[slug]/go-review?f=<feedbackId>`
 * (Milestone 24).
 *
 * The thank-you screen's "Leave a review on Google" button points here instead of
 * straight at Google. This route records that the diner tapped through, then
 * forwards them to the restaurant's real Google review URL. That single stamp is
 * what lets the owner's dashboard say "47 invited → 12 clicked" — the number that
 * answers "what am I actually paying for?".
 *
 * ── The overriding rule: never get between the diner and Google ──────────────
 * This is on the diner's happy path. If ANYTHING here is slow or fails — the
 * feedback id is missing or forged, the tracking write errors, whatever — we still
 * redirect them onward. The worst case is a click we failed to count, never a
 * diner who couldn't leave their review. Tracking is our concern, not theirs.
 */

import { NextResponse } from "next/server";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { markReviewClicked } from "@/lib/feedback";
import { isValidGoogleReviewUrl } from "@/lib/review-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let restaurant;
  try {
    restaurant = await getRestaurantBySlug(slug);
  } catch {
    restaurant = null;
  }

  // No restaurant, no review URL, or a URL that isn't actually a Google link →
  // send them back to the feedback page rather than redirecting off-domain. The
  // save-time validation (M25) should already guarantee Google-only URLs, but we
  // re-check HERE too: this is the thing that actually performs the redirect, so it
  // must never trust a stored value (defense-in-depth against any legacy/bad row).
  if (!restaurant?.googleReviewUrl || !isValidGoogleReviewUrl(restaurant.googleReviewUrl)) {
    return NextResponse.redirect(new URL(`/r/${slug}/feedback`, request.url));
  }

  // Record the click, scoped to THIS restaurant so a forged id can't touch another
  // tenant's data. Best-effort: never let a tracking failure block the redirect.
  const f = Number(new URL(request.url).searchParams.get("f"));
  if (Number.isInteger(f) && f > 0) {
    try {
      await markReviewClicked(f, restaurant.id);
    } catch (err) {
      console.error("[go-review] failed to record click:", err);
    }
  }

  // Onward to Google. 302 (not permanent) — the target could change, and we want
  // the tracking hop to run every time.
  return NextResponse.redirect(restaurant.googleReviewUrl, { status: 302 });
}
