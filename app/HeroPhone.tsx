"use client";

/**
 * The hero phone (Milestone 15).
 *
 * It shows **the customer feedback form** — the screen a guest actually sees — and
 * it stays there. On load it quietly demos itself: the ten rating buttons stagger
 * in, the 9 fills amber, and the Submit button lights up (exactly what the real
 * form does once a score is picked). It never leaves the form: the two *outcome*
 * screens are told later, in the pinned scroll story.
 *
 * The entrance animation sits on the OUTER element and the scroll parallax on the
 * INNER one, so the two never fight over `transform`.
 */

import { useEffect, useRef } from "react";
import PhoneFrame from "./PhoneFrame";

/** The real 1–10 scale, two rows of five — exactly like the product. */
const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PICKED = 9;

export default function HeroPhone() {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = parallaxRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(Math.max(window.scrollY / 700, 0), 1);
        el.style.transform = `translateY(${-40 * p}px) scale(${1 + 0.03 * p})`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="animate-rise"
      style={{ "--rise-delay": "460ms" } as React.CSSProperties}
    >
      <div ref={parallaxRef} className="will-change-transform">
        <PhoneFrame className="mx-auto">
          <div className="flex h-[498px] flex-col px-5 py-6">
            {/* Restaurant header */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-base font-semibold text-white">
                F
              </span>
              <span className="text-[15px] font-semibold text-[#1D1D1F]">
                Fucco
              </span>
              <span className="rounded-full border border-[#E5E5EA] px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73]">
                Table 7
              </span>
            </div>

            {/* Order number */}
            <div className="mt-5">
              <p className="text-[12px] font-medium text-[#1D1D1F]">
                Order number
              </p>
              <div className="mt-1.5 rounded-xl border border-[#E5E5EA] px-3 py-2.5 text-[13px] text-[#AEAEB2]">
                1042
              </div>
            </div>

            {/* The rating scale — this is what animates */}
            <p className="mt-5 text-[13px] font-semibold text-[#1D1D1F]">
              How was your meal?
            </p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {RATINGS.map((n, i) => (
                <div
                  key={n}
                  className="demo-chip relative"
                  style={
                    { "--chip-delay": `${700 + i * 50}ms` } as React.CSSProperties
                  }
                >
                  <div className="flex aspect-square items-center justify-center rounded-xl bg-[#F2F2F7] text-[13px] font-semibold text-[#1D1D1F]">
                    {n}
                  </div>
                  {n === PICKED && (
                    // The pick: an amber layer fades in over the grey chip.
                    <div className="demo-pick absolute inset-0 flex items-center justify-center rounded-xl bg-amber-500 text-[13px] font-semibold text-white shadow-sm shadow-amber-500/40">
                      {n}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between px-0.5 text-[10px] font-medium text-[#AEAEB2]">
              <span>Poor</span>
              <span>Great</span>
            </div>

            {/* Submit: grey until a score is picked, then it lights up amber. */}
            <div className="relative mt-auto">
              <div className="rounded-xl bg-[#F2F2F7] py-3 text-center text-[13px] font-semibold text-[#AEAEB2]">
                Submit feedback
              </div>
              <div className="demo-submit absolute inset-0 rounded-xl bg-amber-500 py-3 text-center text-[13px] font-semibold text-white">
                Submit feedback
              </div>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
