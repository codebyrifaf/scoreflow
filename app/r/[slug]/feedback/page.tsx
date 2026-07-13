/**
 * Customer feedback page, served at `/r/[slug]/feedback` (e.g. /r/fucco/feedback).
 *
 * This is a SERVER component. Its job is to:
 *   1. read the restaurant `slug` from the URL path and the `table` from the query,
 *   2. look up the restaurant in the database,
 *   3. show a clean 404 if the slug doesn't exist, otherwise
 *   4. hand the restaurant details + table to the interactive <FeedbackForm>.
 *
 * Next.js 16 note: both `params` and `searchParams` are PROMISES and must be awaited.
 */

import { notFound } from "next/navigation";
import { getRestaurantForFeedback } from "@/lib/restaurants";
import { activeReviewLinks } from "@/lib/review-platforms";
import FeedbackForm from "./FeedbackForm";

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { slug } = await params;
  const { table } = await searchParams;

  const restaurant = await getRestaurantForFeedback(slug);
  // Unknown restaurant → render the nearest not-found.tsx (a real HTTP 404).
  if (!restaurant) {
    notFound();
  }

  return (
    <FeedbackForm
      slug={restaurant.slug}
      restaurantName={restaurant.name}
      // The brand's logo (M26), shown at the top instead of the initial disc when
      // set. Null for legacy standalone restaurants (no brand) or when unset.
      logoUrl={restaurant.brand?.logoDataUrl ?? null}
      // The review platforms this restaurant has ACTUALLY set (M29) — one logo tile
      // each, in a fixed order. An EMPTY array renders no tiles and no heading at all.
      //
      // That emptiness is deliberate, and it's the M18 lesson: the review link used to
      // fall back to "#", so a diner tapped a big button that went NOWHERE, silently,
      // and the owner never found out their funnel was dead. We show a real link or we
      // show nothing — never a dead button. The owner is warned on their dashboard.
      reviewLinks={activeReviewLinks(restaurant)}
      // Smart review routing (M7): ratings at/above this go to the Google nudge.
      positiveThreshold={restaurant.positiveThreshold}
      table={table ?? null}
    />
  );
}
