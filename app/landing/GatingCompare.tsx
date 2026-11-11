/**
 * "We never hide your review link." — the compliance differentiator (M23; made visual
 * in Milestone 40).
 *
 * This is the strongest, most defensible thing the page can say, and it was buried in
 * ~90 words of prose that a scanning restaurant owner would never read. The claim is
 * inherently VISUAL — it's about what a 3/10 guest is shown — so show it: the same
 * unhappy guest, on two products, side by side. The difference lands in a second and
 * needs no argument.
 *
 * The right-hand screen renders the real REVIEW_PLATFORMS tiles, so it is a picture of
 * what the product actually does, not an idealised drawing of it.
 *
 * The claim itself is sober on purpose: gating breaches Google's review policy and runs
 * into UK rules on misleading reviews, and it's the OWNER's listing that carries the
 * risk. That's the whole point of the section — it reframes "we're more honest" as
 * "we're safer for you", which is the version an owner actually buys.
 */

import { REVIEW_PLATFORMS } from "@/lib/review-platforms";
import Reveal from "../Reveal";
import { CONTAINER, SECTION } from "./tokens";

/** The shell of a thank-you screen — the same white card, whichever product it is. */
function Screen({
  tone,
  label,
  children,
  caption,
}: {
  tone: "muted" | "live";
  label: string;
  children: React.ReactNode;
  caption: React.ReactNode;
}) {
  const live = tone === "live";
  return (
    <div className="flex h-full flex-col">
      <p
        className={`text-[13px] font-semibold ${
          live ? "text-[#0F172A]" : "text-[#94A3B8]"
        }`}
      >
        {label}
      </p>

      {/* ⚠️ FIXED height, not `flex-1`. With `flex-1` each card grew to absorb the
          leftover space after its caption — and the two captions are different
          lengths, so the two mock screens ended up different heights (measured 237 vs
          214), which is exactly the "cards aren't the same size" the comparison must
          avoid. A fixed body makes the two screens identical; the captions below flow
          on their own. Tall enough for the four-tile side (the taller of the two). */}
      <div
        className={`mt-3 h-52 rounded-2xl border bg-white p-6 text-center ${
          live
            ? "border-[#E2E8F0] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.2)]"
            : "border-[#E2E8F0]"
        }`}
      >
        {/* The same guest, the same score, on both sides. */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-medium text-[#64748B]">
          Rated 3 / 10
        </span>
        {children}
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-[#64748B]">{caption}</p>
    </div>
  );
}

export default function GatingCompare() {
  return (
    <section className={`border-y border-[#CBD5E1] bg-[#F1F5F9] ${SECTION}`}>
      <div className={CONTAINER}>
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-[14px] font-medium text-[#64748B]">
              The bit nobody else says out loud
            </p>
            <h2 className="mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0F172A] sm:text-[40px]">
              We never hide your review link.
            </h2>
            {/* ⚠️ The {" "} after </strong> is LOAD-BEARING, not a style preference.
                Written as `</strong> — it`, SWC trims the leading space of the text
                node that follows the element and the page renders "review gating— it":
                a typo, on the most important sentence here. Verified at the byte level
                in the served HTML, not by eye. */}
            <p className="mt-5 text-[17px] leading-relaxed text-[#334155]">
              Plenty of tools show the review button only to guests who rated you well.
              That&apos;s{" "}
              <strong className="font-semibold">review gating</strong>{" "}
              — it breaches Google&apos;s policy and the UK rules on misleading
              reviews. And the listing at risk isn&apos;t ours. It&apos;s{" "}
              <strong className="font-semibold text-[#0F172A]">yours</strong>.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:gap-10">
          <Reveal>
            <Screen
              tone="muted"
              label="A gating tool"
              caption="The unhappy guest is quietly steered away — and one day Google notices."
            >
              <p className="mt-4 text-[15px] font-semibold text-[#0F172A]">
                Thanks for your feedback
              </p>

              {/* The absence IS the point, so it has to be drawn, not described. */}
              <div className="mt-5 flex h-[76px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
                <span className="text-[12px] font-medium text-[#94A3B8]">
                  No review link shown
                </span>
              </div>
            </Screen>
          </Reveal>

          <Reveal delay={120}>
            <Screen
              tone="live"
              label="ScoreFlow"
              caption="The same invitation everyone else gets — while the complaint reaches you first, privately, in seconds."
            >
              <p className="mt-4 text-[15px] font-semibold text-[#0F172A]">
                Thank you — we hear you
              </p>

              <p className="mt-4 text-[12px] font-semibold text-[#0F172A]">
                Leave a review
              </p>
              <div className="mt-2.5 flex flex-wrap items-start justify-center gap-2">
                {REVIEW_PLATFORMS.map((p) => (
                  <div
                    key={p.id}
                    className="flex w-[52px] flex-col items-center gap-1"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.logo}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                    </span>
                    <span className="text-[9px] font-medium leading-tight text-[#64748B]">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </Screen>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
