/**
 * One slide of the sales deck.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ THE SHAPE IS THE POINT: every slide is exactly 4:5, always.               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * 4:5 is the portrait ratio social feeds give the most vertical space to, so a
 * screenshot of one of these cards is a finished post — no cropping, no resizing,
 * no design tool in the loop.
 *
 * ⚠️ The aspect ratio is FIXED and the content fits inside it. It must never be the
 * other way round. M40 hit this exact bug three times on the landing page — cards
 * that sized to their own content came out 491px vs 455px, and the two sides of a
 * comparison ended up 237px vs 214px. Here it would be worse than ugly: a carousel
 * whose frames are different sizes visibly jumps as you swipe through it.
 *
 * The slide number is deliberate too — it's so you can say "change slide 5" and
 * mean something.
 */

import type { ReactNode } from "react";

export default function Slide({
  n,
  children,
  tone = "light",
  className = "",
}: {
  /** 1-based. Shown small in the corner; also how we talk about slides. */
  n: number;
  children: ReactNode;
  /** `dark` for the slides that need to stop a scroll — 1, 5 and 8. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";

  return (
    <figure
      // `qr-card` is the existing print class from M30: `break-inside: avoid`, so a
      // slide is never split across two pages when saved as PDF.
      className={`qr-card relative mx-auto flex aspect-[4/5] w-full max-w-[480px] flex-col overflow-hidden rounded-[28px] border ${
        dark
          ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
          : "border-[#D2D2D7] bg-white text-[#1D1D1F]"
      } ${className}`}
    >
      {/* The colour wash the frosted surfaces pick up. Decorative only — the same
          `.ambient` the landing page uses, and invisible on the dark slides. */}
      {!dark && <div className="ambient" aria-hidden="true" />}

      {/* ⚠️ Two things here were caught by LOOKING at the rendered slides, not by
          measuring them — every automated check passed while both were wrong.

          `pb-16` reserves a band for the wordmark below. The footer is absolutely
          positioned, so without it the content simply ran underneath: the phone
          mockup on slide 3 and the dashboard card on slide 5 both collided with
          "ScoreFlow · n/8".

          `justify-start`, not `justify-between`. With only a heading and a visual,
          space-between put ~40% of the slide as a hole in the middle and broke the
          path between the claim and the evidence for it. Top-packing keeps the two
          together AND pins every headline to the same height, so swiping a carousel
          moves the picture and not the type. `SlideVisual` then absorbs whatever
          height is left over, so the slide still fills its frame. */}
      <div className="relative z-10 flex h-full flex-col justify-start gap-7 p-8 pb-16 sm:p-10 sm:pb-16">
        {children}
      </div>

      {/* Wordmark + number. Small, so it never competes with the message, but present
          on every slide because a carousel frame gets screenshotted and shared on its
          own — an unbranded slide is a slide nobody can trace back to you. */}
      <div
        className={`pointer-events-none absolute inset-x-8 bottom-5 z-10 flex items-center justify-between text-[11px] font-medium sm:inset-x-10 ${
          dark ? "text-white/40" : "text-[#AEAEB2]"
        }`}
      >
        <span className="tracking-[-0.01em]">ScoreFlow</span>
        <span>{n}/8</span>
      </div>
    </figure>
  );
}

/** The one big line on a slide. Sized down hard on small screens — a headline that
 *  wraps mid-phrase is the M40 hero bug, and here it would ruin the screenshot. */
export function SlideTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[34px] ${className}`}
    >
      {children}
    </h2>
  );
}

/** Supporting line. ⚠️ Keep it under ~15 words — that cap is the brief. If a slide
 *  needs a paragraph, it should be two slides. */
export function SlideBody({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className={`mt-3 text-[15px] leading-relaxed sm:text-[17px] ${
        dark ? "text-white/70" : "text-[#6E6E73]"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * The picture half of a slide — always the second child, after the heading block.
 *
 * It takes every pixel of height the heading didn't use (`flex-1`) and centres its
 * contents in that space. Without it the slides looked unfinished at both extremes:
 * the text-only slide 2 left the bottom half of the frame blank, and the visuals on
 * 3 and 7 sat hard under the body copy with a void beneath them.
 *
 * ⚠️ Centring happens HERE and not on the slide's flex container on purpose. Centring
 * the whole column would move the headline up and down depending on how much art each
 * slide carries — and a headline that jumps between frames is exactly the carousel
 * jitter the fixed 4:5 ratio exists to prevent.
 */
export function SlideVisual({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-1 flex-col justify-center ${className}`}>
      {children}
    </div>
  );
}

/** The small label at the top of a slide ("The problem", "The fix"). */
export function SlideKicker({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${
        dark ? "text-white/45" : "text-[#AEAEB2]"
      }`}
    >
      {children}
    </p>
  );
}
