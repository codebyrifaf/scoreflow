"use client";

/**
 * The pinned scroll story — the page's centrepiece (M15; rewritten in M23).
 *
 * A tall section holds a **sticky** phone. As you scroll, the phone stays put while
 * its SCREEN cross-dissolves through five real product screens, and the copy beside
 * it changes in sync.
 *
 * ⚠️ WHY THIS WAS REWRITTEN. The old story sold a product we no longer ship — and
 * deliberately no longer ship:
 *
 *     step 3: "Happy guests go to Google."
 *     step 4: "Unhappy ones come to you."   ← and their screen had NO review button
 *
 * That is **review gating**, and M23 removed it (it breaches Google's review policy
 * and UK rules on misleading reviews). So the landing page was advertising the one
 * behaviour we'd just torn out. Worse, it was burying the feature that actually
 * sells the product: **the instant alert.**
 *
 * The story now matches reality, and leads with the thing an owner actually buys:
 *   1. tap  2. ten seconds  3. EVERY guest is invited to review  4. you're told
 *   immediately  5. it all lands on your dashboard
 *
 * Mechanics unchanged: JS only computes which step is active and sets `data-active`;
 * all motion lives in CSS (`.story-layer`), so we only animate opacity + transform.
 */

import { useEffect, useRef, useState } from "react";
import PhoneFrame from "./PhoneFrame";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STEPS = [
  {
    title: "It starts with a tap.",
    copy: "A guest taps the chip on the table. The form opens instantly — no app, no sign-up, no QR to squint at.",
  },
  {
    title: "Ten seconds. No typing.",
    copy: "They score the meal out of ten and tap a couple of reasons. That's the whole thing — which is why they actually finish it.",
  },
  {
    title: "Every guest is invited to review you.",
    copy: "Including the unhappy ones. Hiding the review link from people who didn't enjoy it is review gating — against Google's rules, and against UK law. We don't do it, and we never will.",
  },
  {
    title: "If someone's unhappy, you know now.",
    copy: "An email reaches you within seconds — while they're still at the table, still holding the bill. That's the difference between a fixed meal and a one-star review.",
  },
  {
    title: "And it all lands on your dashboard.",
    copy: "Every score, every comment, every table. What's going wrong, and whether you're fixing it.",
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

/**
 * Steps 1 & 2: the form.
 *
 * `picked` shows a 3 selected — deliberately a LOW score, because the whole point
 * of steps 3 and 4 is what happens to an unhappy guest. The reasons that appear are
 * the real negative chips, and the question is the real one ("What could be
 * better?"), exactly as the product behaves below the positive threshold.
 */
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
          const on = picked && n === 3;
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

      {/* The quick-tap reasons appear once a score is picked. A low score gets the
          "what went wrong" set — exactly like the real form. */}
      <div
        className={`mt-3 transition-opacity duration-500 ${
          picked ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-[10px] font-semibold text-[#1D1D1F]">
          What could be better?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {["Slow service", "Food was cold", "Too pricey"].map((t, i) => (
            <span
              key={t}
              className={`rounded-full px-2 py-1 text-[9px] font-medium ${
                i === 1
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
          picked ? "bg-amber-500 text-white" : "bg-[#F2F2F7] text-[#AEAEB2]"
        }`}
      >
        Submit feedback
      </div>
    </div>
  );
}

/**
 * Step 3: the thank-you an UNHAPPY guest sees.
 *
 * This screen is the proof of the compliance claim, so it must be exactly what the
 * product renders: a private acknowledgement AND the same Google review button
 * everyone else gets. If you're going to say "we don't gate reviews", the picture
 * had better show it.
 */
function ThankYouScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F2F2F7] text-2xl text-[#8E8E93]">
        ✓
      </div>
      <p className="text-[14px] font-semibold text-[#1D1D1F]">
        Thank you — we hear you
      </p>
      <p className="text-[11px] leading-relaxed text-[#6E6E73]">
        We&apos;re sorry your experience at Fucco fell short.
      </p>

      <p className="w-full rounded-lg bg-[#F2F2F7] px-3 py-2 text-[10px] leading-relaxed text-[#3A3A3C]">
        What you told us has gone straight to the Fucco team so they can put it
        right.
      </p>

      {/* The same invite everyone gets — shown here to a 3/10. That's the point. */}
      <div className="mt-1 w-full rounded-lg bg-amber-500 py-2.5 text-[11px] font-semibold text-white">
        Leave a review on Google
      </div>
      <p className="text-[9px] text-[#AEAEB2]">
        Sharing your honest experience publicly is entirely up to you.
      </p>
    </div>
  );
}

/**
 * Step 4: the alert.
 *
 * The feature that actually sells the product, and it was nowhere on the old page.
 * Shown as the email landing on the owner's phone, seconds later.
 */
function AlertScreen() {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#AEAEB2]">
        Inbox
      </p>

      <div className="mt-3 rounded-xl border border-[#E5E5EA] p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1D1D1F] text-[10px] font-semibold text-white">
            S
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-[#1D1D1F]">
              ScoreFlow
            </p>
            <p className="text-[9px] text-[#AEAEB2]">now</p>
          </div>
        </div>

        <p className="mt-2.5 text-[11px] font-semibold leading-snug text-[#1D1D1F]">
          Fucco: an unhappy diner (3/10)
        </p>

        <div className="mt-2 rounded-lg bg-[#F2F2F7] p-2">
          <p className="text-[10px] font-semibold text-[#1D1D1F]">
            3/10 — order 1042, table 7
          </p>
          <p className="mt-0.5 text-[9px] text-[#6E6E73]">
            Tagged: Food was cold
          </p>
        </div>

        <div className="mt-2.5 rounded-lg bg-amber-500 py-2 text-center text-[10px] font-semibold text-white">
          Open dashboard
        </div>
      </div>

      <p className="mt-auto text-center text-[10px] leading-relaxed text-[#6E6E73]">
        They&apos;re still at table 7.
        <br />
        <span className="font-semibold text-[#1D1D1F]">
          You have about four minutes.
        </span>
      </p>
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

      {/* Needs attention — the worklist, which is what an owner actually opens. */}
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 p-2.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-[#1D1D1F]">
            Needs attention
          </p>
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-700">
            1
          </span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-red-100 text-[10px] font-bold text-red-700">
            3
          </span>
          <div className="min-w-0">
            <p className="truncate text-[9px] font-semibold text-[#1D1D1F]">
              Order 1042 · Table 7
            </p>
            <p className="truncate text-[9px] text-[#6E6E73]">Food was cold</p>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
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
        <div className="mt-2 flex h-11 items-end gap-1">
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
    <ThankYouScreen key="thanks" />,
    <AlertScreen key="alert" />,
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
              <div className="mb-7 flex gap-1.5 lg:mb-9">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`story-tick h-[3px] rounded-full ${
                      i === active ? "w-8 bg-[#1D1D1F]" : "w-4 bg-[#D2D2D7]"
                    }`}
                  />
                ))}
              </div>

              <div className="relative h-[210px] lg:h-[250px]">
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    data-active={active === i}
                    className="story-layer absolute inset-0"
                  >
                    <h3 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] lg:text-[40px]">
                      {s.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#6E6E73] lg:mt-5 lg:text-[17px]">
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
