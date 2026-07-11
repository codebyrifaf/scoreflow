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
 * The design is intentionally light-only, Apple-minimal, and tuned for phones
 * (360–430px).
 *
 * ⚠️ MILESTONE 23 removed the "review routing" this form used to do. Every diner
 * now sees the SAME Google review invite, whatever they scored. See the thank-you
 * screen below for why (short version: selectively inviting only happy customers is
 * review gating — against Google's policy, and a regulatory risk in the UK).
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
   * The "positive experience" line (1–10). It sets the TONE only — which chips we
   * offer and how the thank-you is worded.
   *
   * ⚠️ It does NOT decide who is invited to leave a Google review. Every diner gets
   * the same invite (M23 — see the thank-you screen below for why).
   */
  positiveThreshold: number;
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
  positiveThreshold,
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

  // The quick-tap chips for the currently selected rating: "what did you love?" for
  // a good score, "what could be better?" for a poor one; empty until a rating is
  // picked. Uses THIS restaurant's positiveThreshold, so the question we ask always
  // matches the tone of the thank-you they'll land on.
  const chips = chipsForRating(rating, positiveThreshold);

  /** Pick a rating, and drop any selected chips that don't belong to the new
   *  rating's set (e.g. switching from a low to a high score clears "Slow service"). */
  function selectRating(value: number) {
    setRating(value);
    setSelectedTags((prev) =>
      prev.filter((t) => chipsForRating(value, positiveThreshold).includes(t))
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
  //
  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  MILESTONE 23: NO MORE REVIEW GATING. EVERY DINER GETS THE SAME INVITE.   ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  //
  // This screen used to fork on the rating: happy diners were shown the Google
  // review button, and unhappy ones were shown a private "sorry" screen with NO
  // review link at all. That is **review gating** — selectively soliciting positive
  // reviews — and it is:
  //   • against Google's review policy (they forbid selectively soliciting positive
  //     reviews or discouraging negative ones), and
  //   • a real regulatory risk now the product is sold in the UK, where consumer
  //     law treats misleading review practices seriously. We'd have been selling a
  //     tool that put OUR CUSTOMER in front of a regulator.
  //
  // So the fork is gone. There is now ONE screen. The Google button is identical —
  // same wording, same prominence, same position — no matter what someone scored.
  //
  // We keep the genuinely valuable half: an unhappy diner ALSO gets a sincere
  // acknowledgement that their feedback went straight to the team. That's service
  // recovery, not suppression — it adds a message, it doesn't take the invite away.
  // (The owner still gets alerted; see lib/notifications.ts.)
  if (status === "success") {
    // Only affects the WORDING of the thank-you, never who is invited to review.
    const wasDisappointing = rating < positiveThreshold;

    return (
      <main className={`${PAGE_CLASS} justify-center`}>
        <div className={`${CARD_CLASS} text-center`}>
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
              wasDisappointing
                ? "bg-[#F3F4F6] text-[#6B7280]"
                : "bg-green-50 text-green-600"
            }`}
          >
            ✓
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            {wasDisappointing ? "Thank you — we hear you" : "Thanks for your feedback!"}
          </h1>

          <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
            {wasDisappointing
              ? `We're sorry your experience at ${restaurantName} fell short.`
              : `We really appreciate you taking the time to help ${restaurantName} improve.`}
          </p>

          {/* Service recovery for an unhappy diner — an ADDITIONAL reassurance, not a
              replacement for the review invite below. */}
          {wasDisappointing && (
            <p className="mt-4 rounded-2xl bg-[#F9FAFB] px-4 py-3 text-[14px] leading-relaxed text-[#374151]">
              What you told us has gone straight to the {restaurantName} team so they
              can put it right.
            </p>
          )}

          {/* THE REVIEW INVITE — offered to everyone, identically. If the owner
              hasn't set a link we show nothing at all, rather than a dead button. */}
          {googleReviewUrl && (
            <>
              <a
                href={googleReviewUrl}
                className={`mt-8 block ${PRIMARY_BTN_CLASS}`}
              >
                Leave a review on Google
              </a>
              <p className="mt-3 text-[13px] text-[#9CA3AF]">
                Sharing your honest experience publicly is entirely up to you.
              </p>
            </>
          )}
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
                {rating >= positiveThreshold
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
