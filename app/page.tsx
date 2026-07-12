/**
 * Landing page (M15; rewritten as a real marketing page in M23) — served at `/`.
 *
 * Design brief unchanged: premium, restrained, Apple in spirit. The wordmark IS the
 * logo. No icons, no emoji. Amber appears ONLY inside the product screens, so the
 * product is the single splash of colour on a black-and-white page. And **no fake
 * testimonials, logos or invented stats** — there are no customers yet, and
 * fabricated proof would destroy the trust the page is trying to build.
 *
 * ── What was wrong before (M23 fixed it) ─────────────────────────────────────
 *   • The hero promised "sends happy guests to Google and routes complaints quietly
 *     to you" — i.e. it ADVERTISED review gating, the exact behaviour we removed
 *     because it breaches Google's policy and UK review rules.
 *   • "More five-star reviews" clashed with the product's 1–10 scale.
 *   • The scroll story showed an unhappy guest getting NO review button.
 *   • The instant ALERT — the thing an owner actually buys — appeared nowhere.
 *   • There was no PRICING, which for an SMB buyer is a reason to leave.
 *
 * ── The pitch now ────────────────────────────────────────────────────────────
 * One idea, repeated: **you find out while they're still at the table.** Everything
 * else (compliance, the dashboard, the trial) is support for that.
 *
 * Shape: hero → pinned scroll story → what you get → compliance (the differentiator)
 *        → pricing → FAQ (objections) → close.
 */

import Link from "next/link";
import SiteNav from "./SiteNav";
import Reveal from "./Reveal";
import HeroPhone from "./HeroPhone";
import ScrollStory from "./ScrollStory";

const CONTAINER = "mx-auto w-full max-w-5xl px-6";
const SECTION = "py-24 sm:py-32 lg:py-36";

/** The near-black primary button: 1px lift on hover, gentle press. */
const BTN_DARK =
  "inline-flex items-center justify-center rounded-full bg-[#1D1D1F] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-black hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)] active:scale-[0.98]";
const BTN_LIGHT =
  "inline-flex items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-7 py-3 text-[15px] font-medium text-[#1D1D1F] transition-all duration-150 hover:-translate-y-px hover:border-[#1D1D1F] active:scale-[0.98]";

/**
 * ⚠️ PLACEHOLDER PRICING. These are illustrative numbers for a UK market, not a
 * decision. Change them here; nothing in the app reads them (billing is recorded by
 * the operator, see /operator).
 */
const PRICE_SINGLE = 29;
const PRICE_PER_EXTRA_SITE = 25;
const TRIAL_DAYS = 14;

/** A feature: a hairline that draws itself in, then a title and one line. */
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
    <div
      className={`flex flex-col rounded-3xl p-8 ${
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

      <div className="mt-8 pt-2">
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
          <h1
            className="animate-rise mx-auto mt-4 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1D1D1F] sm:text-[60px] lg:text-[68px]"
            style={{ "--rise-delay": "90ms" } as React.CSSProperties}
          >
            Hear it at the table.
            <br />
            Not on Google.
          </h1>

          <p
            className="animate-rise mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-[#6E6E73] sm:text-[19px]"
            style={{ "--rise-delay": "180ms" } as React.CSSProperties}
          >
            Guests rate their meal out of ten by tapping a chip on the table. If
            someone&apos;s unhappy, you get an email in seconds — while they&apos;re
            still sitting there.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-6"
            style={{ "--rise-delay": "270ms" } as React.CSSProperties}
          >
            <Link href="/signup" className={BTN_DARK}>
              Start {TRIAL_DAYS} days free
            </Link>
            <Link
              href="#story"
              className="link-underline text-[15px] font-medium text-[#1D1D1F]"
            >
              See how it works&nbsp;›
            </Link>
          </div>

          <p
            className="animate-rise mt-7 text-[13px] text-[#AEAEB2]"
            style={{ "--rise-delay": "360ms" } as React.CSSProperties}
          >
            No card required &nbsp;·&nbsp; No app to download &nbsp;·&nbsp; Ten
            seconds per guest
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

      {/* ── What you get ──────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <div className={CONTAINER}>
          <Reveal>
            <h2 className="max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[44px]">
              What you get
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                // The lead feature. It was missing from the old page entirely.
                "An email the moment it happens",
                "A poor score reaches you in seconds — with the table, the order and what went wrong.",
              ],
              [
                "A list of what needs fixing",
                "Unhappy guests sit in one place until you mark them resolved. Nothing quietly disappears.",
              ],
              [
                "Ten seconds, no typing",
                "A score out of ten and a couple of one-tap reasons. That's why guests actually finish it.",
              ],
              [
                "NFC table links",
                "A unique link for every table, ready to write onto a chip. No app, no sign-up.",
              ],
              [
                "Trends, not guesses",
                "Today, this week, this month — and the reasons that keep coming up.",
              ],
              [
                "Several venues, one view",
                "Compare locations side by side. Each manager sees only their own.",
              ],
            ].map(([title, copy], i) => (
              <Reveal key={title} delay={i * 90}>
                <FeatureItem title={title}>{copy}</FeatureItem>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance: the differentiator ─────────────────────────────────
          Most tools in this category quietly gate reviews. Saying plainly that we
          don't is the strongest, most defensible thing we can claim — and it's the
          objection a savvy owner will raise anyway. */}
      <section className={`border-y border-[#D2D2D7] bg-[#F5F5F7] ${SECTION}`}>
        <div className={CONTAINER}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <p className="text-[14px] font-medium text-[#6E6E73]">
                The bit nobody else says out loud
              </p>
              <h2 className="mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F] sm:text-[40px]">
                We never hide your review link.
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <div className="flex flex-col gap-5 text-[16px] leading-relaxed text-[#3A3A3C]">
                <p>
                  Plenty of feedback tools show the Google review button only to
                  guests who rated you well, and quietly bury everyone else. It
                  works — right up until it doesn&apos;t.
                </p>
                <p>
                  That&apos;s <strong>review gating</strong>. It breaches
                  Google&apos;s review policy, and in the UK it runs into the rules
                  on misleading reviews. The listing at risk isn&apos;t ours.
                  It&apos;s <strong>yours</strong>.
                </p>
                <p className="font-medium text-[#1D1D1F]">
                  So every guest gets the same invitation, whatever they scored.
                  Complaints still reach you first, privately, within seconds — and
                  that&apos;s the part that actually protects your rating.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

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
                  "NFC links for every table",
                  "Trends and one-tap reasons",
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
                No. They tap the chip and the form opens in their phone&apos;s
                browser. Nothing to download, nothing to sign up for. It takes about
                ten seconds.
              </Faq>
            </Reveal>
            <Reveal delay={60}>
              <Faq q="Will this get my Google listing in trouble?">
                No — that&apos;s the point. We invite every guest to review you, and
                we never hide the link from someone who scored you badly. Tools that
                do that are review gating, which breaches Google&apos;s policy and UK
                rules on misleading reviews.
              </Faq>
            </Reveal>
            <Reveal delay={120}>
              <Faq q="Can ScoreFlow read my guests' feedback?">
                No. Your feedback is visible to you and the managers you invite —
                nobody else. The staff side of ScoreFlow can see whether your account
                is active and how many responses you&apos;ve had, and that&apos;s
                all. We built it that way on purpose.
              </Faq>
            </Reveal>
            <Reveal delay={180}>
              <Faq q="How long does setup take?">
                Minutes. Sign up, add your tables, and write each table&apos;s link
                onto an NFC chip. Your Google review link goes in once, in settings,
                and you&apos;re live.
              </Faq>
            </Reveal>
            <Reveal delay={240}>
              <Faq q="What happens when the trial ends?">
                Your dashboard pauses until you subscribe — but your guests&apos;
                feedback form keeps working, so the chips on your tables never stop.
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
            <h2 className="mx-auto max-w-2xl text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1D1D1F] sm:text-[52px]">
              Put it on the table.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-[#6E6E73]">
              {TRIAL_DAYS} days free. No card. The next unhappy guest tells you
              instead of Google.
            </p>
            <div className="mt-9">
              <Link href="/signup" className={BTN_DARK}>
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
