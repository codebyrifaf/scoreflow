"use client";

/**
 * The pinned scroll story (Milestone 15) — the page's centrepiece.
 *
 * A tall section holds a **sticky** phone. As you scroll through it, the phone
 * stays put while its SCREEN cross-dissolves through five real product screens,
 * and the copy beside it changes in sync:
 *
 *   1. the feedback form   2. a score picked   3. happy → Google
 *   4. unhappy → private   5. the owner dashboard
 *
 * This replaces the old "Not every rating…" and "How it works" sections — it tells
 * both stories, better, and nothing repeats.
 *
 * Mechanics: JS only computes which step is active (from scroll position) and sets
 * `data-active`; all the actual motion lives in CSS (`.story-layer` in globals.css),
 * so we only ever animate `opacity` + `transform`.
 */

import { useEffect, useRef, useState } from "react";
import PhoneFrame from "./PhoneFrame";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STEPS = [
  {
    title: "It starts with a tap.",
    copy: "A guest taps the NFC chip on the table. The feedback form opens instantly — no app, no sign-up.",
  },
  {
    title: "Ten seconds, no typing.",
    copy: "They pick a score from one to ten and tap a couple of quick reasons. That's the whole thing.",
  },
  {
    title: "Happy guests go to Google.",
    copy: "A great meal becomes a public review, while the memory is still fresh.",
  },
  {
    title: "Unhappy ones come to you.",
    copy: "A poor experience arrives privately — before it ever becomes a one-star.",
  },
  {
    title: "It all lands on your dashboard.",
    copy: "Ratings, comments, order numbers and trends. Visible only to you.",
  },
];

// ── The five screens ─────────────────────────────────────────────────────────

/** Shared restaurant header. */
function ScreenHeader() {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-[13px] font-semibold text-white">
        F
      </span>
      <span className="text-[13px] font-semibold text-[#1D1D1F]">Fucco</span>
      <span className="rounded-full border border-[#E5E5EA] px-2 py-0.5 text-[9px] font-medium text-[#6E6E73]">
        Table 7
      </span>
    </div>
  );
}

/** Steps 1 & 2: the form — optionally with a score picked and reasons tapped. */
function FormScreen({ picked }: { picked: boolean }) {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <ScreenHeader />

      <div className="mt-4">
        <p className="text-[10px] font-medium text-[#1D1D1F]">Order number</p>
        <div className="mt-1 rounded-lg border border-[#E5E5EA] px-2.5 py-1.5 text-[11px] text-[#AEAEB2]">
          1042
        </div>
      </div>

      <p className="mt-4 text-[11px] font-semibold text-[#1D1D1F]">
        How was your meal?
      </p>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        {RATINGS.map((n) => {
          const on = picked && n === 9;
          return (
            <div
              key={n}
              className={`flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold transition-all duration-500 ${
                on
                  ? "scale-105 bg-amber-500 text-white shadow-sm shadow-amber-500/40"
                  : "bg-[#F2F2F7] text-[#1D1D1F]"
              }`}
            >
              {n}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between px-0.5 text-[9px] font-medium text-[#AEAEB2]">
        <span>Poor</span>
        <span>Great</span>
      </div>

      {/* The quick-tap reasons appear once a score is picked. */}
      <div
        className={`mt-3 transition-opacity duration-500 ${
          picked ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-[10px] font-semibold text-[#1D1D1F]">
          What did you love?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {["Delicious", "Great service", "Cozy vibe"].map((t, i) => (
            <span
              key={t}
              className={`rounded-full px-2 py-1 text-[9px] font-medium ${
                i === 0
                  ? "bg-amber-500 text-white"
                  : "bg-[#F2F2F7] text-[#1D1D1F]"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`mt-auto rounded-lg py-2.5 text-center text-[11px] font-semibold transition-colors duration-500 ${
          picked
            ? "bg-amber-500 text-white"
            : "bg-[#F2F2F7] text-[#AEAEB2]"
        }`}
      >
        Submit feedback
      </div>
    </div>
  );
}

/** Steps 3 & 4: the two outcomes. */
function OutcomeScreen({ happy }: { happy: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
          happy ? "bg-green-50 text-green-600" : "bg-[#F2F2F7] text-[#8E8E93]"
        }`}
      >
        ✓
      </div>
      <p className="text-[14px] font-semibold text-[#1D1D1F]">
        {happy ? "Thanks for your feedback" : "Thank you — we hear you"}
      </p>
      <p className="text-[11px] leading-relaxed text-[#6E6E73]">
        {happy
          ? "We really appreciate you taking the time to help Fucco improve."
          : "We're sorry your experience fell short. Your feedback goes straight to the Fucco team."}
      </p>
      {happy && (
        <div className="mt-1 w-full rounded-lg bg-amber-500 py-2.5 text-[11px] font-semibold text-white">
          Leave us a Google review
        </div>
      )}
    </div>
  );
}

/** Step 5: the owner's dashboard. */
function DashboardScreen() {
  const bars = [7.8, 8.2, 6.9, 8.8, 9.1, 8.4, 8.9];
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <p className="text-[13px] font-semibold text-[#1D1D1F]">Fucco</p>
      <p className="text-[10px] text-[#6E6E73]">Feedback dashboard</p>

      <div className="mt-3 inline-flex w-fit rounded-full bg-[#F2F2F7] p-0.5 text-[9px] font-medium">
        {["All", "Today", "Week", "Month"].map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-2 py-1 ${
              i === 2 ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#6E6E73]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#E5E5EA] p-2.5">
          <p className="text-[9px] text-[#6E6E73]">Responses</p>
          <p className="text-[17px] font-bold text-[#1D1D1F]">128</p>
        </div>
        <div className="rounded-lg border border-[#E5E5EA] p-2.5">
          <p className="text-[9px] text-[#6E6E73]">Average</p>
          <p className="text-[17px] font-bold text-[#1D1D1F]">8.6</p>
        </div>
      </div>

      <div className="mt-2.5 rounded-lg border border-[#E5E5EA] p-2.5">
        <p className="text-[9px] text-[#6E6E73]">Last 7 days</p>
        <div className="mt-2 flex h-12 items-end gap-1">
          {bars.map((v, i) => (
            <div key={i} className="flex-1">
              <div
                className="w-full rounded-t bg-amber-500"
                style={{ height: `${(v / 10) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex gap-2 rounded-lg border border-[#E5E5EA] p-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-green-50 text-[11px] font-bold text-green-700">
          9
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold text-[#1D1D1F]">
            Order 1042 · Table 7
          </p>
          <p className="truncate text-[10px] text-[#6E6E73]">Delicious</p>
        </div>
      </div>
    </div>
  );
}

// ── The story ────────────────────────────────────────────────────────────────

export default function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        if (total <= 0) return;
        // 0 → 1 across the whole pinned section.
        const p = Math.min(Math.max(-rect.top / total, 0), 1);
        const idx = Math.min(Math.floor(p * STEPS.length), STEPS.length - 1);
        setActive((prev) => (prev === idx ? prev : idx));
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  const screens = [
    <FormScreen key="form" picked={false} />,
    <FormScreen key="rated" picked />,
    <OutcomeScreen key="happy" happy />,
    <OutcomeScreen key="private" happy={false} />,
    <DashboardScreen key="dash" />,
  ];

  return (
    <section ref={sectionRef} className="relative h-[500vh] bg-[#F5F5F7]">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            {/* The phone — pinned. Only the screen inside it changes. */}
            <div className="order-1 flex justify-center lg:order-2">
              <PhoneFrame width="w-[248px] lg:w-[290px]">
                <div className="relative h-[420px] lg:h-[478px]">
                  {screens.map((screen, i) => (
                    <div
                      key={i}
                      data-active={active === i}
                      className="story-layer absolute inset-0"
                    >
                      {screen}
                    </div>
                  ))}
                </div>
              </PhoneFrame>
            </div>

            {/* The copy — changes in sync. */}
            <div className="order-2 lg:order-1">
              {/* Step indicator */}
              <div className="mb-7 flex gap-1.5 lg:mb-9">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`story-tick h-[3px] rounded-full ${
                      i === active
                        ? "w-8 bg-[#1D1D1F]"
                        : "w-4 bg-[#D2D2D7]"
                    }`}
                  />
                ))}
              </div>

              <div className="relative h-[150px] lg:h-[190px]">
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    data-active={active === i}
                    className="story-layer absolute inset-0"
                  >
                    <h3 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] lg:text-[40px]">
                      {s.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#6E6E73] lg:mt-5 lg:text-[18px]">
                      {s.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
