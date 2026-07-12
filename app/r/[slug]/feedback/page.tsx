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
      // Pass NULL when no review URL is set — never "#" (Milestone 18).
      // It used to fall back to "#", which meant a happy diner tapped a big amber
      // "Leave us a Google review" button that went NOWHERE, silently. The whole
      // point of the product quietly stopped working and nobody found out. Now the
      // form simply doesn't render the button, and the owner is warned on their
      // dashboard (which they can now fix themselves, on their settings page).
      googleReviewUrl={restaurant.googleReviewUrl || null}
      // Smart review routing (M7): ratings at/above this go to the Google nudge.
      positiveThreshold={restaurant.positiveThreshold}
      table={table ?? null}
    />
  );
}
