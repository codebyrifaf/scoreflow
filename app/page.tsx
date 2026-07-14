/**
 * Landing page (M15; rewritten as a real marketing page in M23; re-pitched in M40)
 * — served at `/`.
 *
 * Design brief unchanged: premium, restrained, Apple in spirit. The wordmark IS the
 * logo. No icons, no emoji. Amber appears ONLY inside the product screens, so the
 * product is the single splash of colour on a black-and-white page. And **no fake
 * testimonials, logos or invented stats** — there are no customers yet, and
 * fabricated proof would destroy the trust the page is trying to build. (The example
 * numbers inside the product mocks are plainly a screenshot of an example, and are
 * internally consistent; they are not a claim about anyone's results.)
 *
 * ── What M40 fixed ───────────────────────────────────────────────────────────
 * The product grew enormously between M24 and M39; the page didn't. It was still
 * selling the M23 product, and in two places it argued AGAINST our own features:
 *
 *   • The story said "no QR to squint at" — while M30 had made the printable QR kit
 *     the flagship way to go live with no hardware. The page was rubbishing its own
 *     best answer to "is this a hassle to set up?".
 *   • The hero sold NFC chips ("tapping a chip on the table"), i.e. a purchase, as
 *     the way in.
 *   • The product invites guests to FOUR platforms (M29); every word on the page
 *     said "Google". Tripadvisor, Yelp and Zomato were invisible.
 *   • The two things that actually close and RETAIN a sale — the review-click ROI
 *     ("12 of the 47 guests we invited tapped through") and the win-back contact
 *     capture — appeared nowhere at all.
 *
 * The fix deliberately did NOT add four more sections: a longer page is the exact
 * failure mode here. Two short sections were added (SetupStrip, PlatformRow), one was
 * rebuilt to carry the missing proof (ProofCards), and the wordiest one was cut down
 * to a single picture (GatingCompare). More proof, less prose, same length.
 *
 * ── The pitch ────────────────────────────────────────────────────────────────
 * One idea, repeated: **you find out while they're still at the table.** Everything
 * else (setup, platforms, compliance, the trial) is support for that.
 *
 * Shape: hero → pinned scroll story → setting up (nothing to buy) → what you get
 *        (the proof) → where the reviews land → compliance (the differentiator)
 *        → pricing → FAQ (objections) → close.
 */

import Link from "next/link";
import SiteNav from "./SiteNav";
import Reveal from "./Reveal";
import HeroPhone from "./HeroPhone";
import ScrollStory from "./ScrollStory";
import SetupStrip from "./landing/SetupStrip";
import PlatformRow from "./landing/PlatformRow";
import ProofCards from "./landing/ProofCards";
import GatingCompare from "./landing/GatingCompare";
import { CONTAINER, SECTION, BTN_DARK, BTN_LIGHT, TRIAL_DAYS } from "./landing/tokens";
import { appUrl } from "@/lib/app-url";
import { qrMatrix } from "@/lib/qr";

/**
 * ⚠️ PLACEHOLDER PRICING. These are illustrative numbers for a UK market, not a
 * decision. Change them here; nothing in the app reads them (billing is recorded by
 * the operator, see /operator).
 */
const PRICE_SINGLE = 29;
const PRICE_PER_EXTRA_SITE = 25;

/** One pricing card. */
function PriceCard({
  name,
  price,
  unit,
  blurb,
  points,
  featured,
}: {
  name: string;
  price: string;
  unit: string;
  blurb: string;
  points: string[];
  featured?: boolean;
}) {
  return (
    // ⚠️ `h-full` is what keeps the two cards the SAME height. Each card carries a
    // different number of feature lines (the single plan lists six, the group plan
    // five), so left to itself each sizes to its own content and they end up
    // mismatched (measured: 491px vs 455px). The grid row already stretches to the
    // taller card; `h-full` makes the shorter card fill that row, and `mt-auto` on
    // the button (below) pins both CTAs to a common baseline.
    <div
      className={`flex h-full flex-col rounded-3xl p-8 ${
        featured
          ? // The featured card stays SOLID near-black. Glass on the card you most
            // want read would be a strange thing to do — it needs to be the most
            // legible object on the page, not the most decorative.
            "bg-[#1D1D1F] text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
          : "glass text-[#1D1D1F]"
      }`}
    >
      <p
        className={`text-[15px] font-semibold ${
          featured ? "text-white" : "text-[#1D1D1F]"
        }`}
      >
        {name}
      </p>
      <p
        className={`mt-1 text-[14px] leading-relaxed ${
          featured ? "text-white/60" : "text-[#6E6E73]"
        }`}
      >
        {blurb}
      </p>

      <div className="mt-7 flex items-baseline gap-1.5">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
          {price}
        </span>
        <span
          className={`text-[14px] ${featured ? "text-white/60" : "text-[#6E6E73]"}`}
        >
          {unit}
        </span>
      </div>

      <ul className="mt-7 flex flex-col gap-2.5">
        {points.map((p) => (
          <li
            key={p}
            className={`text-[14px] leading-relaxed ${
              featured ? "text-white/80" : "text-[#3A3A3C]"
            }`}
          >
            {p}
          </li>
        ))}
      </ul>

      {/* `mt-auto` pushes the CTA to the bottom of the (now equal-height) card, so
          both buttons align even when one card has fewer feature lines. */}
      <div className="mt-auto pt-8">
        <Link
          href="/signup"
          className={
            featured
              ? "inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-3 text-[15px] font-medium text-[#1D1D1F] transition-all duration-150 hover:-translate-y-px active:scale-[0.98]"
              : `w-full ${BTN_LIGHT}`
          }
        >
          Start {TRIAL_DAYS} days free
        </Link>
      </div>
    </div>
  );
}

/** One FAQ entry — a native <details>, so it works with no JavaScript. */
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-[#D2D2D7] py-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium text-[#1D1D1F] marker:hidden">
        {q}
        <span className="flex-none text-[#AEAEB2] transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#6E6E73]">
        {children}
      </p>
    </details>
  );
}

export default function Home() {
  /**
   * The QR shown on the specimen table card in the setup strip.
   *
   * REAL, not decorative: it's the same `qrMatrix()` the print kit uses, and it
   * genuinely resolves — a fake QR on the page of the company whose whole pitch is
   * "we're the honest tool" would be a very cheap thing to be caught doing, and
   * anyone with a camera can check in two seconds.
   *
   * It encodes /signup, so scanning it from a desktop hands the trial to your phone.
   * The strip says so in plain words underneath. This is a server component and
   * `qrMatrix` is synchronous, so the matrix is computed once at build.
   */
  const signupQr = qrMatrix(`${appUrl()}/signup`);

  return (
    <div className="font-system min-h-dvh w-full bg-white text-[#1D1D1F] antialiased">
      <SiteNav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* The colour the frosted nav picks up as you scroll over it. Decorative
            only — see `.ambient` in globals.css. */}
        <div className="ambient" aria-hidden="true" />

        <div className={`relative z-10 ${CONTAINER} text-center`}>
          <p
            className="animate-rise text-[14px] font-medium text-[#6E6E73]"
            style={{ "--rise-delay": "0ms" } as React.CSSProperties}
          >
            For restaurants
          </p>

          {/* The whole product in one line: you hear about it while you can still
              do something about it. */}
          {/* MOBILE SIZE IS DELIBERATE (30px, not 40px). At 40px the line "Hear it at
              the table." needs ~410px, but a 375px phone leaves only 327px of content
              width — so it wrapped in the middle of the phrase, and `leading-[1.05]`
              (beautiful at 68px, far too tight at 40px) made the wrapped lines collide.
              30px lets each line land intact even on the narrowest phone still in use.
              `sm:` restores the desktop values exactly. */}
          <h1
            className="animate-rise mx-auto mt-4 max-w-3xl text-[30px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#1D1D1F] sm:text-[60px] sm:leading-[1.05] lg:text-[68px]"
            style={{ "--rise-delay": "90ms" } as React.CSSProperties}
          >
            Hear it at the table.
            <br />
            Not on Google.
          </h1>

          {/* ⚠️ This used to read "…by tapping a chip on the table" — which sold NFC
              hardware (a purchase, and a chore to program) as the way in. Since M30 the
              honest and far easier answer is a printed QR card, so that's what leads.
              NFC is still offered; it's just no longer the price of entry. */}
          <p
            className="animate-rise mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-[#6E6E73] sm:text-[19px]"
            style={{ "--rise-delay": "180ms" } as React.CSSProperties}
          >
            Guests scan the card on the table and rate their meal out of ten. If
            someone&apos;s unhappy, you get an email in seconds — while they&apos;re
            still sitting there.
          </p>

          {/* On a phone these stack: a full-width primary button (a proper thumb
              target, and the standard mobile pattern) with the secondary link beneath.
              `sm:` puts them back on one row exactly as they are today. */}
          <div
            className="animate-rise mt-8 flex flex-col items-center justify-center gap-5 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-6"
            style={{ "--rise-delay": "270ms" } as React.CSSProperties}
          >
            <Link href="/signup" className={`w-full sm:w-auto ${BTN_DARK}`}>
              Start {TRIAL_DAYS} days free
            </Link>
            <Link
              href="#story"
              className="link-underline text-[15px] font-medium text-[#1D1D1F]"
            >
              See how it works&nbsp;›
            </Link>
          </div>

          {/* Four honest, scannable facts — the closest thing to "social proof" this
              page is entitled to. Every one of them is a property of the product, not
              an invented statistic. They wrap gracefully on a phone. */}
          <p
            className="animate-rise mt-7 text-[13px] text-[#AEAEB2]"
            style={{ "--rise-delay": "360ms" } as React.CSSProperties}
          >
            Live tonight &nbsp;·&nbsp; Nothing to buy &nbsp;·&nbsp; Ten seconds per
            guest &nbsp;·&nbsp; {TRIAL_DAYS} days free, no card
          </p>

          <div className="mt-16 sm:mt-20">
            <HeroPhone />
          </div>
        </div>
      </section>

      {/* ── The pinned scroll story ──────────────────────────────────────── */}
      <div id="story" className="scroll-mt-0">
        <ScrollStory />
      </div>

      {/* ── Setting up: the objection that stops trials ───────────────────
          "Is this a hassle?" is the first thing an owner thinks, and until M30 the
          answer was genuinely yes (buy NFC chips, program them). Answer it in three
          pictures, early, before they can leave. */}
      <SetupStrip qr={signupQr} />

      {/* ── What you get: the proof ────────────────────────────────────────
          Carries the two features that close and retain a sale — the review-click
          ROI, and the win-back — which the page had never shown. */}
      <ProofCards />

      {/* ── Where the reviews land ─────────────────────────────────────────
          Four platforms, not just Google. Hands off into the compliance section. */}
      <PlatformRow />

      {/* ── Compliance: the differentiator ─────────────────────────────────
          Most tools in this category quietly gate reviews. Saying plainly that we
          don't is the strongest, most defensible thing we can claim — and it's the
          objection a savvy owner will raise anyway. Shown, now, rather than argued:
          the same 3/10 guest, on a gating tool and on us. */}
      <GatingCompare />

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className={`relative overflow-hidden ${SECTION}`}>
        {/* Ambience again — without colour behind it, the glass price card would
            just be a white box with extra render cost. */}
        <div className="ambient" aria-hidden="true" />

        <div className={`relative z-10 ${CONTAINER}`}>
          <Reveal>
            <div className="text-center">
              <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[44px]">
                One price. Everything included.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-[#6E6E73]">
                No setup fee, no per-response charge, no upsell for the features that
                matter. Cancel whenever you like.
              </p>
            </div>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
            <Reveal>
              <PriceCard
                name="One restaurant"
                blurb="Everything, for a single venue."
                price={`£${PRICE_SINGLE}`}
                unit="/ month"
                points={[
                  "Unlimited guest responses",
                  "Instant unhappy-guest alerts",
                  "Needs-attention worklist",
                  // ⚠️ Was "NFC links for every table" — stale since M30, and it
                  // implied hardware was required. QR leads; NFC is the option.
                  "Printable QR kit — or NFC",
                  "Google, Tripadvisor, Yelp & Zomato",
                  "See how many guests clicked through",
                ]}
              />
            </Reveal>

            <Reveal delay={120}>
              <PriceCard
                featured
                name="Several locations"
                blurb="One account, every venue."
                price={`£${PRICE_PER_EXTRA_SITE}`}
                unit="/ month, per venue"
                points={[
                  "Everything in the single plan",
                  "All venues compared side by side",
                  "A manager login per venue",
                  "One daily summary across the group",
                  "Managers only see their own venue",
                ]}
              />
            </Reveal>
          </div>

          <Reveal delay={200}>
            <p className="mt-10 text-center text-[14px] text-[#6E6E73]">
              {TRIAL_DAYS} days free, no card required. Prices exclude VAT.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ: kill the obvious objections ──────────────────────────────── */}
      <section className={`border-t border-[#D2D2D7] ${SECTION}`}>
        <div className={CONTAINER}>
          <Reveal>
            <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[40px]">
              Reasonable questions
            </h2>
          </Reveal>

          <div className="mt-10 max-w-3xl">
            <Reveal>
              <Faq q="Does the guest need an app?">
                No. They point their camera at the card and the form opens in their
                phone&apos;s browser. Nothing to download, nothing to sign up for. It
                takes about ten seconds.
              </Faq>
            </Reveal>
            <Reveal delay={60}>
              <Faq q="Which review sites can you send guests to?">
                Google, Tripadvisor, Yelp and Zomato. Add the links you actually use
                in settings — leave one blank and it simply doesn&apos;t appear.
                Guests pick the one they already have an account with, which is a
                large part of why they follow through.
              </Faq>
            </Reveal>
            <Reveal delay={120}>
              <Faq q="Will this get my Google listing in trouble?">
                No — that&apos;s the point. We invite every guest to review you, and
                we never hide the link from someone who scored you badly. Tools that
                do that are review gating, which breaches Google&apos;s policy and UK
                rules on misleading reviews.
              </Faq>
            </Reveal>
            <Reveal delay={180}>
              <Faq q="Can ScoreFlow read my guests' feedback?">
                No. Your feedback is visible to you and the managers you invite —
                nobody else. The staff side of ScoreFlow can see whether your account
                is active and how many responses you&apos;ve had, and that&apos;s
                all. We built it that way on purpose.
              </Faq>
            </Reveal>
            <Reveal delay={240}>
              <Faq q="How long does setup take?">
                Minutes, with no hardware to buy. Sign up, add your tables, then print
                the built-in QR kit and stand a card on each table — that&apos;s it.
                Prefer tap-to-rate? Write each table&apos;s link onto an NFC chip
                instead. Add your review links once, in settings, and you&apos;re live.
              </Faq>
            </Reveal>
            <Reveal delay={300}>
              <Faq q="What happens when the trial ends?">
                Your dashboard pauses until you subscribe — but your guests&apos;
                feedback form keeps working, so the cards on your tables never stop.
                You can close your account and delete everything at any time.
              </Faq>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <section className={`bg-[#F5F5F7] ${SECTION}`}>
        <div className={`${CONTAINER} text-center`}>
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F] sm:text-[52px] sm:leading-[1.05]">
              Put it on the table.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-[#6E6E73]">
              {TRIAL_DAYS} days free. No card. The next unhappy guest tells you
              instead of Google.
            </p>
            <div className="mt-9">
              <Link href="/signup" className={`w-full sm:w-auto ${BTN_DARK}`}>
                Start {TRIAL_DAYS} days free
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#D2D2D7]">
        <div
          className={`${CONTAINER} flex flex-col items-center justify-between gap-4 py-10 sm:flex-row`}
        >
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
            ScoreFlow
          </span>
          <span className="text-[13px] text-[#AEAEB2]">
            © {new Date().getFullYear()} ScoreFlow
          </span>
          <div className="flex items-center gap-5">
            <Link
              href="#pricing"
              className="link-underline text-[13px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="link-underline text-[13px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
