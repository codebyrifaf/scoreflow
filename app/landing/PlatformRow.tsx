/**
 * "Send them where it counts." — the four-platform row (Milestone 40).
 *
 * WHY THIS SECTION EXISTS. M29 added Tripadvisor, Yelp and Zomato alongside Google:
 * a guest who's just rated their meal sees a row of logo tiles and picks the platform
 * they actually use. The landing page never mentioned it — every word on the page still
 * said "Google", so a tourist-facing venue that lives or dies on Tripadvisor had no way
 * of knowing we covered them. An entire feature, invisible.
 *
 * The tiles are rendered from REVIEW_PLATFORMS — the same list the diner's feedback page
 * and the owner's settings form read. That's deliberate: this section can't drift from
 * the product the way the old copy did, because there is no second list to forget.
 *
 * The closing line ("every guest sees the same invitation") is the handoff into the
 * compliance section, which is the argument that actually wins the sale.
 */

import { REVIEW_PLATFORMS } from "@/lib/review-platforms";
import Reveal from "../Reveal";
import { CONTAINER, SECTION } from "./tokens";

export default function PlatformRow() {
  return (
    // No hairline: this sits between the grey proof grid and the grey compliance
    // band, so the change of background is already the separator.
    <section className={SECTION}>
      <div className={`${CONTAINER} text-center`}>
        <Reveal>
          <p className="text-[14px] font-medium text-[#6E6E73]">
            Where the reviews land
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[44px]">
            Send them where it counts.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#6E6E73]">
            A tourist leaves a Tripadvisor review. A local leaves a Google one. You
            choose which platforms your guests are offered — and every guest sees the
            same ones.
          </p>
        </Reveal>

        {/* The real tiles, exactly as a diner sees them.
            ⚠️ THE MOBILE SIZE IS LOAD-BEARING. All four must sit on ONE row, because a
            2×2 wrap reads as "two platforms and two extras" rather than "four equals" —
            which is the entire point of the section. The budget is tight, so it's worked
            out rather than eyeballed:
              • a 375px phone leaves 327px inside the page gutter (px-6);
              • a 360px Android — still common — leaves only 312px.
            4 × 64px + 3 × 8px = 280px, which clears both with room to spare. (The first
            draft used 72px tiles and 12px gaps = 324px: it fitted a 375px screen by 3px
            and WRAPPED on a 360px one.) `sm:` restores the roomy desktop tiles.
            `flex-wrap` is the safety net on a 320px SE, not the expected layout. */}
        <Reveal delay={120}>
          <div className="mt-12 flex flex-wrap items-start justify-center gap-2 sm:gap-5">
            {REVIEW_PLATFORMS.map((p) => (
              <div
                key={p.id}
                className="flex w-16 flex-col items-center gap-2 sm:w-[104px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white shadow-sm sm:h-16 sm:w-16">
                  {/* Local SVG — the CSP (M25) is `img-src 'self'`, so a CDN-hosted
                      logo would be silently blocked. The name is spelled out below,
                      so the mark itself is decorative. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="h-6 w-6 object-contain sm:h-8 sm:w-8"
                  />
                </span>
                <span className="text-center text-[11px] font-medium leading-tight text-[#6E6E73] sm:text-[13px]">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <p className="mx-auto mt-10 max-w-md text-[14px] leading-relaxed text-[#AEAEB2]">
            Add the links you use in settings. Leave one blank and it simply
            doesn&apos;t appear.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
