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
 *
 * ── This endpoint is PUBLIC and UNAUTHENTICATED ─────────────────────────────
 * It has to be: a diner taps an NFC chip and submits without logging in. So it is
 * the most exposed surface in the product, and the spam guard below is the only
 * thing standing between a paying restaurant and a competitor burying their
 * dashboard in fake 1-star reviews.
 *
 * MILESTONE 17 rebuilt that guard, because it did not actually work:
 *   • It hashed the LEFTMOST `X-Forwarded-For` entry — a value the CALLER writes.
 *     Sending a random one per request produced a fresh "IP" every time, so the
 *     per-IP rate limit never once fired. See lib/request-ip.ts.
 *   • `comment` had no length cap, so one request could store megabytes.
 *   • `tags` accepted any string, so an attacker could write their own text into
 *     the owner's "Top mentions" panel.
 */

import { after } from "next/server";
import { getRestaurantBySlug } from "@/lib/restaurants";
import {
  createFeedback,
  countRecentByIpHash,
  countRecentForRestaurant,
  hasRecentDuplicate,
} from "@/lib/feedback";
import { clientIpHash } from "@/lib/request-ip";
import { acceptableChips } from "@/lib/chips-for-order";
import { notifyComplaint } from "@/lib/notifications";
import type { FeedbackPayload } from "@/lib/types";

/** The JSON body we expect: the customer's input, the slug, and a honeypot. */
type FeedbackRequestBody = Partial<FeedbackPayload> & {
  slug?: unknown;
  /** Honeypot: a hidden field real users leave empty; bots tend to fill it. */
  website?: unknown;
};

// ── Spam-guard limits ───────────────────────────────────────────────────────
// Layer 1, per CALLER. Lenient on purpose: a busy restaurant has MANY diners on
// ONE shared Wi-Fi IP, so tight per-IP limits would block real customers. These
// still stop a script flood (which submits far faster) while leaving a dinner
// rush alone.
const MAX_PER_MINUTE = 15;
const MAX_PER_HOUR = 120;

// Layer 2, per RESTAURANT (Milestone 17) — a ceiling that does NOT depend on who
// is calling, so rotating IPs can't get around it. Set well above any real dinner
// rush (a 100-table venue turning over every 45 min is nowhere near 30/min), but
// low enough that a flood can't bury a dashboard.
const MAX_PER_MINUTE_PER_RESTAURANT = 30;
const MAX_PER_HOUR_PER_RESTAURANT = 300;

/** Window in which the same order number counts as a duplicate. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

// Input caps (Milestone 17). Without these a single request could store megabytes,
// inflating the database and slowing the owner's dashboard to a crawl.
const MAX_COMMENT_LENGTH = 1000;
const MAX_ORDER_NUMBER_LENGTH = 32;
const MAX_TABLE_LENGTH = 30;
const MAX_TAGS = 10;
// Optional win-back contact (M24). Capped like everything else a stranger can send.
const MAX_CONTACT_NAME_LENGTH = 80;
const MAX_CONTACT_PHONE_LENGTH = 40;

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
    return Response.json({ error: "Missing restaurant." }, { status: 400 });
  }
  const restaurant = await getRestaurantBySlug(body.slug);
  if (!restaurant) {
    return Response.json({ error: "Unknown restaurant." }, { status: 404 });
  }

  // 3. Validate the customer's input. We never trust the browser — not its
  //    values, and not the SIZE of them.
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return Response.json(
      { error: "Rating must be a whole number from 1 to 10." },
      { status: 400 }
    );
  }

  if (typeof body.orderNumber !== "string" || body.orderNumber.trim() === "") {
    return Response.json({ error: "Order number is required." }, { status: 400 });
  }
  const orderNumber = body.orderNumber.trim();
  if (orderNumber.length > MAX_ORDER_NUMBER_LENGTH) {
    return Response.json({ error: "That order number is too long." }, { status: 400 });
  }

  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length > MAX_COMMENT_LENGTH) {
    return Response.json(
      { error: `Please keep your comment under ${MAX_COMMENT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const table = typeof body.table === "string" ? body.table.trim() : "";
  if (table.length > MAX_TABLE_LENGTH) {
    return Response.json({ error: "Invalid table." }, { status: 400 });
  }

  // Optional win-back contact (M24). Both optional; capped and trimmed. We don't
  // over-validate the phone (people write "+44 …", "text me on …") — just bound it.
  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const contactPhone =
    typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  if (
    contactName.length > MAX_CONTACT_NAME_LENGTH ||
    contactPhone.length > MAX_CONTACT_PHONE_LENGTH
  ) {
    return Response.json({ error: "Contact details are too long." }, { status: 400 });
  }

  // 4. Build a clean payload (the timestamp is added by the database default).
  //
  //    ╔═══════════════════════════════════════════════════════════════════════╗
  //    ║ THE TAG WHITELIST — still a CLOSED SET, now derived per restaurant.   ║
  //    ╚═══════════════════════════════════════════════════════════════════════╝
  //
  //    Tags come from the quick-tap chips. Before M17 this endpoint accepted ANY
  //    string, which let an attacker post arbitrary text and have it appear in the
  //    owner's "Top mentions" panel — not an XSS (React escapes it) but a
  //    defacement of the widget the owner reads most.
  //
  //    M17 fixed that with a global constant. Chips are now per-dish, so the list
  //    is built on the SERVER from the same ladder that decided what this diner was
  //    shown (lib/chips-for-order.ts) — never from anything the client sent. A tag
  //    that isn't on it is silently dropped, exactly as before.
  //
  //    ⚠️ It must never be relaxed to "accept what the client sends". The whole
  //    point is that the set is ours, not theirs.
  //
  //    The same call also tells us WHICH DISHES this order was, which we snapshot
  //    onto the row — that's what lets the dashboard say "the burger is the
  //    problem" rather than just "someone was unhappy".
  const { allowed: allowedChips, dishNames } = await acceptableChips({
    restaurantId: restaurant.id,
    brandId: restaurant.brandId,
    orderNumber,
    positiveThreshold: restaurant.positiveThreshold,
  });

  const payload: FeedbackPayload = {
    table: table || null,
    orderNumber,
    rating,
    comment,
    contactName,
    contactPhone,
    tags: Array.isArray(body.tags)
      ? Array.from(
          new Set(
            (body.tags as unknown[])
              .filter((t): t is string => typeof t === "string")
              .filter((t) => allowedChips.has(t))
          )
        ).slice(0, MAX_TAGS)
      : [],
  };

  // 5. Spam guard — runs before we save anything.
  const ipHash = clientIpHash(request.headers);
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60_000);
  const oneHourAgo = new Date(now - 3_600_000);

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

  // 5b. Layer 1 — rate-limit by hashed IP (now from a header the caller cannot
  //     forge; see lib/request-ip.ts).
  // 5c. Layer 2 — a per-restaurant ceiling. This one holds even if an attacker
  //     rotates through real IPs, because it doesn't care who is calling.
  const [lastMinute, lastHour, restaurantMinute, restaurantHour] =
    await Promise.all([
      countRecentByIpHash(ipHash, oneMinuteAgo),
      countRecentByIpHash(ipHash, oneHourAgo),
      countRecentForRestaurant(restaurant.id, oneMinuteAgo),
      countRecentForRestaurant(restaurant.id, oneHourAgo),
    ]);

  const tooManyFromCaller =
    lastMinute >= MAX_PER_MINUTE || lastHour >= MAX_PER_HOUR;
  const tooManyForRestaurant =
    restaurantMinute >= MAX_PER_MINUTE_PER_RESTAURANT ||
    restaurantHour >= MAX_PER_HOUR_PER_RESTAURANT;

  if (tooManyFromCaller || tooManyForRestaurant) {
    return Response.json(
      { error: "Too many submissions right now. Please try again shortly." },
      { status: 429 }
    );
  }

  // 6. Save it, tied to the resolved restaurant's id (with the hashed IP). We keep
  //    the new row's id so the thank-you screen can build a review link we can
  //    attribute a click back to (M24).
  let feedbackId: number;
  try {
    feedbackId = await createFeedback(restaurant.id, payload, ipHash, dishNames);
  } catch (err) {
    console.error("Failed to save feedback:", err);
    return Response.json(
      { error: "Could not save your feedback. Please try again." },
      { status: 500 }
    );
  }

  // 7. Was this diner unhappy? If so, tell whoever should know (Milestone 18).
  //
  //    `after()` runs this AFTER the response has been sent. That matters: the
  //    diner is standing at their table waiting for the thank-you screen, and
  //    looking up recipients + sending email would add seconds to their tap — and
  //    if the email provider were down, it would fail their submission entirely.
  //    Their feedback is already safely saved by this point; notifying is our
  //    problem, not theirs.
  //
  //    Note the threshold: `alertThreshold` (default 5, "genuinely unhappy"), NOT
  //    `positiveThreshold` (default 8, "earns a Google invite"). Alerting on the
  //    latter would email the owner about a 7/10 — a good meal — and they'd mute
  //    alerts within a week.
  if (payload.rating <= restaurant.alertThreshold) {
    after(() => notifyComplaint(restaurant.id));
  }

  // 8. Success. Return the feedback id so the thank-you screen's review link can
  //    carry it (…/go-review?f=<id>) and we can attribute the click. The id is a
  //    plain autoincrement — not sensitive, and only handed to the diner who just
  //    created it.
  return Response.json({ ok: true, id: feedbackId }, { status: 201 });
}
