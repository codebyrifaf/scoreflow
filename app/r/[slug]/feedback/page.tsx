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
import { getRestaurantBySlug } from "@/lib/restaurants";
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

  const restaurant = await getRestaurantBySlug(slug);
  // Unknown restaurant → render the nearest not-found.tsx (a real HTTP 404).
  if (!restaurant) {
    notFound();
  }

  return (
    <FeedbackForm
      slug={restaurant.slug}
      restaurantName={restaurant.name}
      // Fall back to "#" if this restaurant has no review URL set yet.
      googleReviewUrl={restaurant.googleReviewUrl ?? "#"}
      // Smart review routing (M7): ratings at/above this go to the Google nudge.
      reviewThreshold={restaurant.reviewThreshold}
      table={table ?? null}
    />
  );
}
