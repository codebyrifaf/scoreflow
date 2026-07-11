"use client";

/**
 * The customer feedback form (premium mobile-first redesign — Milestone 9).
 *
 * This is a CLIENT component (note the "use client" directive on the very first
 * line). It has to be, because it uses React state and click/typing handlers —
 * things that only run in the browser. The page that renders it
 * (`app/r/[slug]/feedback/page.tsx`) stays a SERVER component: it looks up the
 * restaurant by slug and passes the details down as props.
 *
 * The design is intentionally light-only (clean white card on a soft off-white
 * background), Apple-minimal, and tuned for phones (360–430px). All of the
 * behaviour (rating state, submit, validation, and the smart happy/private
 * routing from Milestone 7) is unchanged from before — only the styling changed.
 */

import { useState } from "react";
import type { FeedbackPayload } from "@/lib/types";
import { chipsForRating } from "@/lib/feedback-chips";

/** The 10 rating values, [1, 2, 3, ... 10], built once so we can `.map()` over them. */
const RATINGS = Array.from({ length: 10 }, (_, i) => i + 1);

/** The four states the form can be in, which drive what we show on screen. */
type Status = "idle" | "submitting" | "success" | "error";

/** Props the server page passes in — all about which restaurant this is for. */
interface FeedbackFormProps {
  /** URL slug, e.g. "fucco". Sent to the API so the server knows the restaurant. */
  slug: string;
  /** Display name, e.g. "Fucco". */
  restaurantName: string;
  /**
   * Where the thank-you "Leave us a Google review" link points, or `null` if this
   * restaurant hasn't set one. When it's null we show NO button rather than a dead
   * one (Milestone 18) — a button that goes nowhere is worse than no button, because
   * the diner thinks they've left a review and the owner never finds out they haven't.
   */
  googleReviewUrl: string | null;
  /**
   * Smart review routing (Milestone 7): the minimum rating (1–10) that gets the
   * Google review nudge. Ratings at/above it → public-review screen; below it →
   * a private "sorry" screen with no review link.
   */
  reviewThreshold: number;
  /** Table number from the URL (`?table=`), or null if not provided. */
  table: string | null;
}

// ── Shared style tokens (kept here so every field/screen stays consistent) ────
/** Full clean WHITE screen — no card, no grey background, no shadow. The phone
 *  screen itself is the surface; content just sits on it with comfy padding.
 *  (Form is top-aligned so a tall form never clips; short "thank-you" screens
 *  add `justify-center` to sit in the middle.) */
const PAGE_CLASS =
  "font-system flex min-h-dvh w-full flex-col items-center bg-white px-5 py-10 text-[#111827]";
/** Centres the content column and fades it in on load (no card styling). */
const CARD_CLASS = "animate-card-in w-full max-w-[430px]";
/** Text inputs / textarea: rounded, light border, soft brand focus ring. */
const FIELD_CLASS =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
/** Primary full-width button (brand accent) with a gentle press animation. */
const PRIMARY_BTN_CLASS =
  "w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]";

/** The circular brand logo — the restaurant's first initial on a brand-color disc. */
function BrandLogo({ name }: { name: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-3xl font-semibold text-white shadow-sm">
      {name.charAt(0)}
    </div>
  );
}

export default function FeedbackForm({
  slug,
  restaurantName,
  googleReviewUrl,
  reviewThreshold,
  table,
}: FeedbackFormProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [orderNumber, setOrderNumber] = useState("");
  const [rating, setRating] = useState(0); // 0 means "nothing selected yet"
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Honeypot: a field humans never see. Real users leave it empty; bots that
  // auto-fill every input trip it, and the server rejects the submission.
  const [website, setWebsite] = useState("");

  // The quick-tap chips to show for the currently selected rating (positive set
  // for high ratings, "what went wrong" set for low; empty until a rating exists).
  // We pass THIS restaurant's reviewThreshold — the same number that decides which
  // thank-you screen they'll land on — so the question we ask always matches the
  // outcome. (Before M18 this was hardcoded to 7 while routing used 8, so a 7/10
  // was asked "what did you love?" and then told "sorry your experience fell short".)
  const chips = chipsForRating(rating, reviewThreshold);

  /** Pick a rating, and drop any selected chips that don't belong to the new
   *  rating's set (e.g. switching from a low to a high score clears "Slow service"). */
  function selectRating(value: number) {
    setRating(value);
    setSelectedTags((prev) =>
      prev.filter((t) => chipsForRating(value, reviewThreshold).includes(t))
    );
  }

  /** Toggle a chip on/off. */
  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  /** Handle the form submit: validate, POST to the API, then show a result. */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser from doing a full-page reload

    // Client-side validation. The server double-checks this too (never trust
    // the browser alone), but catching it here gives instant feedback.
    if (rating === 0) {
      setErrorMessage("Please tap a rating from 1 to 10.");
      return;
    }
    if (orderNumber.trim() === "") {
      setErrorMessage("Please enter your order number.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    // The customer's input (see lib/types.ts) plus the restaurant `slug` so the
    // server can resolve WHICH restaurant this feedback belongs to.
    const payload: FeedbackPayload & { slug: string } = {
      slug,
      table,
      orderNumber: orderNumber.trim(),
      rating,
      comment: comment.trim(),
      tags: selectedTags,
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, website }),
      });

      if (!res.ok) {
        // Try to surface the server's error message if it sent one.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  // ── Thank-you screen (shown after a successful submit) ─────────────────────
  // Smart review routing (Milestone 7): the feedback is already saved either way.
  // We only choose WHICH thank-you screen to show based on the rating:
  //   • rating >= reviewThreshold → happy path: nudge toward a Google review.
  //   • rating <  reviewThreshold → private path: a "sorry, we hear you" screen
  //     with NO public-review link, so unhappy experiences stay private.
  if (status === "success") {
    const isHappy = rating >= reviewThreshold;

    // Happy path — encourage a public Google review.
    if (isHappy) {
      return (
        <main className={`${PAGE_CLASS} justify-center`}>
          <div className={`${CARD_CLASS} text-center`}>
            {/* Green success circle */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-4xl text-green-600">
              ✓
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Thanks for your feedback!
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
              We really appreciate you taking the time to help {restaurantName}{" "}
              improve.
            </p>
            {/* Uses THIS restaurant's Google review link (from the database). If the
                owner hasn't set one, we show NOTHING here rather than a button that
                silently goes nowhere. */}
            {googleReviewUrl && (
              <a href={googleReviewUrl} className={`mt-8 block ${PRIMARY_BTN_CLASS}`}>
                Leave us a Google review
              </a>
            )}
          </div>
        </main>
      );
    }

    // Private path — the experience fell short. Acknowledge sincerely and do NOT
    // show any public-review link.
    return (
      <main className={`${PAGE_CLASS} justify-center`}>
        <div className={`${CARD_CLASS} text-center`}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F3F4F6] text-4xl text-[#6B7280]">
            ✓
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Thank you — we hear you
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
            We&apos;re sorry your experience at {restaurantName} fell short. Your
            feedback has been sent privately to the {restaurantName} team so they
            can make it right. Thank you for taking the time to tell us.
          </p>
        </div>
      </main>
    );
  }

  // ── The feedback form itself ───────────────────────────────────────────────
  return (
    <main className={PAGE_CLASS}>
      <div className={CARD_CLASS}>
        {/* Header: brand logo + restaurant name + table chip */}
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo name={restaurantName} />
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            {restaurantName}
          </h1>
          {table ? (
            <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-sm font-medium text-[#6B7280]">
              Table {table}
            </span>
          ) : (
            // Shown when someone opens the page without a ?table= in the URL.
            <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-sm font-medium text-[#9CA3AF]">
              Table not set
            </span>
          )}
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          {/* Honeypot — hidden off-screen; humans never fill it, bots often do. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden opacity-0"
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Order number ---------------------------------------------------- */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="orderNumber"
              className="text-sm font-medium text-[#111827]"
            >
              Order number
            </label>
            <input
              id="orderNumber"
              type="text"
              inputMode="numeric"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. 1042"
              className={FIELD_CLASS}
            />
          </div>

          {/* Rating 1–10 ----------------------------------------------------- */}
          <div className="flex flex-col gap-3">
            <span className="text-base font-semibold text-[#111827]">
              How was your meal?
            </span>
            {/* Two rows of 5 large, thumb-friendly, square buttons. */}
            <div className="grid grid-cols-5 gap-2.5">
              {RATINGS.map((value) => {
                const selected = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectRating(value)}
                    aria-pressed={selected}
                    aria-label={`Rate ${value} out of 10`}
                    className={`flex aspect-square min-h-11 items-center justify-center rounded-2xl text-lg font-semibold transition-all duration-200 ease-out ${
                      selected
                        ? "scale-105 bg-amber-500 text-white shadow-md shadow-amber-500/30"
                        : "bg-[#F3F4F6] text-[#111827] hover:bg-[#ECEEF2] active:scale-95"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            {/* Scale hints: "Poor" under the first button, "Great" under the last. */}
            <div className="flex justify-between px-1 text-xs font-medium text-[#6B7280]">
              <span>Poor</span>
              <span>Great</span>
            </div>
          </div>

          {/* Quick-tap chips (appear once a rating is chosen) ---------------- */}
          {chips.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-base font-semibold text-[#111827]">
                {rating >= reviewThreshold
                  ? "What did you love?"
                  : "What could be better?"}{" "}
                <span className="font-normal text-[#9CA3AF]">(optional)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => {
                  const on = selectedTags.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleTag(chip)}
                      aria-pressed={on}
                      className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                        on
                          ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                          : "bg-[#F3F4F6] text-[#111827] hover:bg-[#ECEEF2] active:scale-95"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional comment ------------------------------------------------ */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="comment"
              className="text-sm font-medium text-[#111827]"
            >
              Comment{" "}
              <span className="font-normal text-[#9CA3AF]">(optional)</span>
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us anything you'd like…"
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          {/* Validation / server error message ------------------------------- */}
          {errorMessage && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {errorMessage}
            </p>
          )}

          {/* Submit button --------------------------------------------------- */}
          <button
            type="submit"
            // Disabled while the request is in flight, or until a rating is chosen.
            disabled={status === "submitting" || rating === 0}
            className={`${PRIMARY_BTN_CLASS} disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100`}
          >
            {status === "submitting" ? "Submitting…" : "Submit feedback"}
          </button>
        </form>
      </div>
    </main>
  );
}
