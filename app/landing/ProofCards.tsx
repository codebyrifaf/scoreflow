/**
 * "What you get" — rebuilt as a visual proof grid (Milestone 40).
 *
 * WHAT WAS WRONG. This section used to be six title-and-paragraph pairs: pure prose,
 * nothing to look at, and — worse — it left out the two features that actually sell
 * and RETAIN the product:
 *
 *   • the review-click ROI (M24/M29). "12 of the 47 guests we invited tapped through"
 *     is the number that answers *"what am I paying £29 a month for?"*. Nobody else in
 *     this category shows it. It was nowhere on the page.
 *   • the win-back contact capture (M24). An unhappy guest leaving their phone number
 *     instead of a one-star review is the most emotionally persuasive thing the product
 *     does, and the page had never mentioned it.
 *
 * So rather than bolt two MORE sections onto an already long page — which would make
 * the reading problem worse, not better — those two stories become the two hero cards
 * *here*, carrying real product visuals, and the remaining six blurbs are cut to one
 * short line each. More proof, less prose, same page length.
 *
 * The visuals deliberately reuse the vocabulary of the real screens (the bordered white
 * card, the red worklist tile, the amber bar) so they read as the product rather than
 * as marketing illustration. They are fluid, not fixed-width, so they reflow on a phone
 * instead of needing the `scale-[…]` trick the ScrollStory phone needs.
 *
 * ⚠️ The numbers are illustrative but INTERNALLY CONSISTENT (9 + 3 = 12; 12/47 = 26%),
 * and the phone number is in Ofcom's reserved-for-drama 07700 900xxx range. They are
 * plainly a screenshot of an example, not a claim about real customers — see the
 * no-fake-proof rule in the page header.
 */

import { REVIEW_PLATFORMS } from "@/lib/review-platforms";
import Reveal from "../Reveal";
import { CONTAINER, SECTION } from "./tokens";

/** A supporting feature: a hairline that draws itself in, then a title and one line. */
function FeatureItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="hairline-draw h-px w-full bg-[#D2D2D7]" />
      <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
        {title}
      </h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[#6E6E73]">
        {children}
      </p>
    </div>
  );
}

/** The shell both hero cards share: the headline claim, then the product visual. */
function HeroCard({
  eyebrow,
  title,
  children,
  visual,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-[#E5E5EA] bg-white p-7 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.18)] sm:p-8">
      <p className="text-[13px] font-medium text-[#AEAEB2]">{eyebrow}</p>
      <h3 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#1D1D1F] sm:text-[26px]">
        {title}
      </h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[#6E6E73]">
        {children}
      </p>
      <div className="mt-7">{visual}</div>
    </div>
  );
}

/**
 * Hero visual 1 — the review-click panel.
 *
 * The per-platform split is keyed off REVIEW_PLATFORMS so the logos can't drift; only
 * the two platforms with clicks in this example are shown, which is exactly how the
 * real dashboard behaves (a platform with no link set has no row).
 */
function ReviewClicks() {
  const clicks: Record<string, number> = { google: 9, tripadvisor: 3 };
  const shown = REVIEW_PLATFORMS.filter((p) => clicks[p.id]);

  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-[#FAFAFB] p-5">
      <p className="text-[11px] font-medium text-[#6E6E73]">
        Review clicks · last 30 days
      </p>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[36px] font-bold leading-none tracking-[-0.03em] text-[#1D1D1F]">
          26%
        </span>
        <span className="text-[13px] text-[#6E6E73]">tapped through</span>
      </div>
      <p className="mt-1.5 text-[12px] text-[#6E6E73]">
        12 of the 47 guests we invited
      </p>

      {/* The bar is the same 26%, drawn — not a decorative width. */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E5EA]">
        <div className="h-full w-[26%] rounded-full bg-amber-500" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.logo}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 flex-none object-contain"
            />
            <span className="flex-1 text-[12px] text-[#3A3A3C]">{p.name}</span>
            <span className="text-[12px] font-semibold text-[#1D1D1F]">
              {clicks[p.id]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Hero visual 2 — the worklist entry, with the guest's number attached. */
function WinBack() {
  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-[#FAFAFB] p-5">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold text-[#1D1D1F]">Needs attention</p>
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
          1
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-3">
        <div className="flex gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-red-100 text-[13px] font-bold text-red-700">
            3
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[#1D1D1F]">
              Order 1042 · Table 7
            </p>
            <p className="truncate text-[12px] text-[#6E6E73]">Food was cold</p>
          </div>
        </div>

        {/* The bit that matters: they left a way to reach them. */}
        <div className="mt-3 flex items-center gap-2 border-t border-red-200/70 pt-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[#1D1D1F]">
              Sarah
            </p>
            <p className="truncate text-[11px] text-[#6E6E73]">07700 900123</p>
          </div>
          <span className="flex-none rounded-full bg-[#1D1D1F] px-3 py-1.5 text-[11px] font-medium text-white">
            Call back
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ProofCards() {
  return (
    <section className={`bg-[#F5F5F7] ${SECTION}`}>
      <div className={CONTAINER}>
        <Reveal>
          <h2 className="max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[44px]">
            What you get
          </h2>
        </Reveal>

        {/* The two cards that answer the two questions an owner actually has:
            "does it work?" and "is it worth the money?" */}
        <div className="mt-14 grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Reveal>
            <HeroCard
              eyebrow="Proof it's working"
              title="See exactly what you're paying for."
              visual={<ReviewClicks />}
            >
              Every guest is invited to review you. We count how many actually went —
              and which platform they chose.
            </HeroCard>
          </Reveal>

          <Reveal delay={120}>
            <HeroCard
              eyebrow="Before it becomes a review"
              title="Turn a bad night into a regular."
              visual={<WinBack />}
            >
              An unhappy guest can leave their name and number. Ring them before they
              ever reach for their phone.
            </HeroCard>
          </Reveal>
        </div>

        {/* Everything else — one line each. No paragraphs. */}
        <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "An email in seconds",
              "A poor score reaches you with the table, the order and what went wrong.",
            ],
            [
              "A list of what needs fixing",
              "Unhappy guests stay in one place until you mark them resolved.",
            ],
            [
              "Ten seconds, no typing",
              "A score out of ten and a couple of one-tap reasons — so guests finish it.",
            ],
            [
              "Trends, not guesses",
              "Today, this week, this month — and the reasons that keep coming up.",
            ],
            [
              "Several venues, one view",
              "Compare locations side by side. Each manager sees only their own.",
            ],
            [
              "Private by default",
              "Your guests' feedback is yours. ScoreFlow staff can't read it — by design.",
            ],
          ].map(([title, copy], i) => (
            <Reveal key={title} delay={i * 90}>
              <FeatureItem title={title}>{copy}</FeatureItem>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
