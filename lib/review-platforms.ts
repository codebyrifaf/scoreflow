/**
 * The review platforms a restaurant can send diners to (Milestone 29).
 *
 * ONE list, read by everything: the Settings form (which fields to render), the
 * feedback page (which logo tiles to show), and the /go-review redirect (which URL to
 * resolve). Keeping it in a single place is what stops those three drifting apart —
 * a platform that exists in the form but not the redirect is a dead button, and a
 * dead button is the exact silent failure M18 was created to kill.
 *
 * ⚠️ DEPENDENCY-FREE ON PURPOSE. The Settings form is a CLIENT component and imports
 * this, so it must never import Prisma or anything server-only — that would drag the
 * database client into the browser bundle. (lib/money.ts lives under the same rule.)
 * It's plain data plus pure functions; the `Restaurant` shape is described
 * structurally below rather than imported from the generated Prisma types.
 *
 * The platform list is FIXED at four by decision (no OpenTable, no additions). If
 * that ever changes, add an entry here AND a case in `isValidReviewUrl`
 * (lib/review-url.ts) — that function fails closed on an unknown platform, so a
 * forgotten case rejects links rather than waving them through unvalidated.
 */

import type { ReviewPlatform } from "./review-url";

export type { ReviewPlatform };

/** The Restaurant columns this module reads. Structural — no Prisma import. */
export interface RestaurantReviewLinks {
  googleReviewUrl: string | null;
  tripadvisorUrl: string | null;
  yelpUrl: string | null;
  zomatoUrl: string | null;
}

export interface ReviewPlatformDef {
  id: ReviewPlatform;
  /** Shown to the diner under the logo, and to the owner as the field label. */
  name: string;
  /** Local SVG. ⚠️ MUST be local: the CSP (M25) is `img-src 'self' data: blob:`, so a
   *  CDN-hosted logo would be silently blocked. See public/logos/README.md. */
  logo: string;
  /** The `Restaurant` column this platform's URL lives in. */
  field: keyof RestaurantReviewLinks;
  /** Placeholder in the Settings field — shows the owner the shape of a real link. */
  example: string;
  /** One line telling the owner where to find their link. */
  help: string;
}

/**
 * Fixed display order. Google first because it's the one that actually moves a
 * restaurant's business; the rest follow in rough order of reach.
 */
export const REVIEW_PLATFORMS: readonly ReviewPlatformDef[] = [
  {
    id: "google",
    name: "Google",
    logo: "/logos/google.svg",
    field: "googleReviewUrl",
    example: "https://g.page/r/…/review",
    help: "In your Google Business Profile, use the “Ask for reviews” short link.",
  },
  {
    id: "tripadvisor",
    name: "Tripadvisor",
    logo: "/logos/tripadvisor.svg",
    field: "tripadvisorUrl",
    example: "https://www.tripadvisor.co.uk/Restaurant_Review-…",
    help: "Open your restaurant's Tripadvisor page and copy the address bar.",
  },
  {
    id: "yelp",
    name: "Yelp",
    logo: "/logos/yelp.svg",
    field: "yelpUrl",
    example: "https://www.yelp.com/biz/your-restaurant",
    help: "Open your Yelp business page and copy the address bar.",
  },
  {
    id: "zomato",
    name: "Zomato",
    logo: "/logos/zomato.svg",
    field: "zomatoUrl",
    example: "https://www.zomato.com/city/your-restaurant",
    help: "Open your Zomato page and copy the address bar.",
  },
] as const;

/** Is this string one of our platforms? Used to validate the `?p=` URL parameter. */
export function isReviewPlatform(value: unknown): value is ReviewPlatform {
  return (
    typeof value === "string" &&
    REVIEW_PLATFORMS.some((p) => p.id === value)
  );
}

/** The definition for a platform id, or undefined. */
export function reviewPlatform(id: ReviewPlatform): ReviewPlatformDef | undefined {
  return REVIEW_PLATFORMS.find((p) => p.id === id);
}

/** One link the diner can actually be shown. */
export interface ActiveReviewLink {
  platform: ReviewPlatform;
  name: string;
  logo: string;
  /** The raw destination. Used as a fallback href; normally we route via /go-review. */
  url: string;
}

/**
 * The platforms this restaurant has ACTUALLY set, in display order.
 *
 * Empty when the owner has configured none — in which case the feedback page renders
 * no tiles and no heading at all, rather than an empty box or a dead button.
 */
export function activeReviewLinks(
  restaurant: RestaurantReviewLinks
): ActiveReviewLink[] {
  const links: ActiveReviewLink[] = [];
  for (const p of REVIEW_PLATFORMS) {
    const url = restaurant[p.field];
    if (url && url.trim() !== "") {
      links.push({ platform: p.id, name: p.name, logo: p.logo, url });
    }
  }
  return links;
}

/** Does this restaurant have any review link at all? Drives the dashboard warning. */
export function hasAnyReviewLink(restaurant: RestaurantReviewLinks): boolean {
  return activeReviewLinks(restaurant).length > 0;
}
