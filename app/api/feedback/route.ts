/**
 * API route handler for customer feedback submissions.
 *
 * In Next.js 16 (App Router), an API endpoint is a "Route Handler": a file
 * named `route.ts` exporting functions named after HTTP verbs. This file lives at
 * `app/api/feedback/route.ts`, so it handles requests to `/api/feedback`.
 *
 * Multi-tenancy (Milestone 4): the request body includes the restaurant `slug`
 * (which the form knows from its URL). This route resolves that slug to a real
 * restaurant IN THE DATABASE and stores the feedback against that restaurant's
 * id. The client never sends a restaurant id or name directly — so it can't
 * attach feedback to a restaurant it shouldn't.
 */

import { createHash } from "node:crypto";
import { getRestaurantBySlug } from "../../../lib/restaurants";
import {
  createFeedback,
  countRecentByIpHash,
  hasRecentDuplicate,
} from "../../../lib/feedback";
import type { FeedbackPayload } from "../../../lib/types";

/** The JSON body we expect: the customer's input, the slug, and a honeypot. */
type FeedbackRequestBody = Partial<FeedbackPayload> & {
  slug?: unknown;
  /** Honeypot: a hidden field real users leave empty; bots tend to fill it. */
  website?: unknown;
};

// ── Spam-guard limits (Milestone 13) ────────────────────────────────────────
// Lenient on purpose: a busy restaurant has MANY diners on ONE shared Wi-Fi IP,
// so tight per-IP limits would block real customers. These still stop a script
// flood (which submits far faster) while leaving a dinner rush alone.
const MAX_PER_MINUTE = 15;
const MAX_PER_HOUR = 120;
/** Window in which the same order number counts as a duplicate. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/** A salted SHA-256 hash of the caller's IP — we never store the raw IP. */
function callerIpHash(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    fwd.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${ip}:${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex");
}

/**
 * POST /api/feedback
 * Resolves the restaurant from the slug, validates the input, and saves it.
 */
export async function POST(request: Request) {
  // 1. Parse the JSON body sent by the form.
  let body: FeedbackRequestBody;
  try {
    body = (await request.json()) as FeedbackRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  // 1b. Honeypot: the form has a hidden "website" field humans never see. If it's
  //     filled, this is almost certainly a bot — quietly pretend it worked (so the
  //     bot doesn't learn) but save nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true }, { status: 201 });
  }

  // 2. Resolve which restaurant this is for, from the slug — server-side, against
  //    the database. We never trust a restaurant identity sent directly.
  if (typeof body.slug !== "string" || body.slug.trim() === "") {
    return Response.json(
      { error: "Missing restaurant." },
      { status: 400 }
    );
  }
  const restaurant = await getRestaurantBySlug(body.slug);
  if (!restaurant) {
    return Response.json(
      { error: "Unknown restaurant." },
      { status: 404 }
    );
  }

  // 3. Basic validation of the customer's input. We never trust the browser.
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return Response.json(
      { error: "Rating must be a whole number from 1 to 10." },
      { status: 400 }
    );
  }
  if (typeof body.orderNumber !== "string" || body.orderNumber.trim() === "") {
    return Response.json(
      { error: "Order number is required." },
      { status: 400 }
    );
  }

  // 4. Build a clean payload (the timestamp is added by the database default).
  //    Tags come from the quick-tap chips (Milestone 9). We sanitise hard — only
  //    non-empty strings, each ≤ 40 chars, at most 10 — so a hostile client can't
  //    stuff the field with junk.
  const payload: FeedbackPayload = {
    table: typeof body.table === "string" ? body.table : null,
    orderNumber: body.orderNumber.trim(),
    rating,
    comment: typeof body.comment === "string" ? body.comment.trim() : "",
    tags: Array.isArray(body.tags)
      ? (body.tags as unknown[])
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= 40)
          .slice(0, 10)
      : [],
  };

  // 5. Spam guard — runs before we save anything.
  const ipHash = callerIpHash(request);
  const now = Date.now();

  // 5a. Reject an exact duplicate order number within the dedupe window (stops
  //     accidental double-submits and trivial repeat-spam of one order).
  if (
    await hasRecentDuplicate(
      restaurant.id,
      payload.orderNumber,
      new Date(now - DEDUPE_WINDOW_MS)
    )
  ) {
    return Response.json(
      { error: "We've already received feedback for that order — thank you!" },
      { status: 429 }
    );
  }

  // 5b. Rate-limit by hashed IP (per minute and per hour).
  const [lastMinute, lastHour] = await Promise.all([
    countRecentByIpHash(ipHash, new Date(now - 60_000)),
    countRecentByIpHash(ipHash, new Date(now - 3_600_000)),
  ]);
  if (lastMinute >= MAX_PER_MINUTE || lastHour >= MAX_PER_HOUR) {
    return Response.json(
      { error: "Too many submissions right now. Please try again shortly." },
      { status: 429 }
    );
  }

  // 6. Save it, tied to the resolved restaurant's id (with the hashed IP).
  try {
    await createFeedback(restaurant.id, payload, ipHash);
  } catch (err) {
    console.error("Failed to save feedback:", err);
    return Response.json(
      { error: "Could not save your feedback. Please try again." },
      { status: 500 }
    );
  }

  // 6. Success. 201 Created is the conventional status for "we made a new record".
  return Response.json({ ok: true }, { status: 201 });
}
