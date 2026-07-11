/**
 * Landing page (Milestone 15) — served at `/`.
 *
 * A static SERVER component. The design brief: premium, trustworthy, restrained —
 * Apple in spirit. Typography and the product itself do all the work.
 *
 *   • The wordmark "ScoreFlow" IS the logo. No mark, no disc, no icon.
 *   • ZERO icons and ZERO emoji anywhere on the page.
 *   • Amber appears ONLY inside the product screens, so the product is the single
 *     splash of colour on an otherwise black-and-white page.
 *   • No fake testimonials, customer logos or invented stats — there are no
 *     customers yet, and fabricated proof would destroy the trust we're building.
 *
 * Shape: hero (the feedback form, shown large) → a PINNED SCROLL STORY that walks
 * through five real product screens → what you get → close.
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

export default function Home() {
  return (
    <div className="font-system min-h-dvh w-full bg-white text-[#1D1D1F] antialiased">
      <SiteNav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
        <div className={`${CONTAINER} text-center`}>
          <p
            className="animate-rise text-[14px] font-medium text-[#6E6E73]"
            style={{ "--rise-delay": "0ms" } as React.CSSProperties}
          >
            For restaurants
          </p>

          <h1
            className="animate-rise mx-auto mt-4 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1D1D1F] sm:text-[60px] lg:text-[68px]"
            style={{ "--rise-delay": "90ms" } as React.CSSProperties}
          >
            More five-star reviews.
            <br />
            Fewer bad surprises.
          </h1>

          <p
            className="animate-rise mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-[#6E6E73] sm:text-[19px]"
            style={{ "--rise-delay": "180ms" } as React.CSSProperties}
          >
            ScoreFlow collects honest feedback at the table, then sends happy
            guests to Google and routes complaints quietly to you.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-6"
            style={{ "--rise-delay": "270ms" } as React.CSSProperties}
          >
            <Link href="/login" className={BTN_DARK}>
              Sign in
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
            No app to download &nbsp;·&nbsp; Works on any phone &nbsp;·&nbsp; Ten
            seconds
          </p>

          {/* The product, shown large. It demos itself once, then rests on the form. */}
          <div className="mt-16 sm:mt-20">
            <HeroPhone />
          </div>
        </div>
      </section>

      {/* ── The pinned scroll story ───────────────────────────────────────────
          The phone stays put while its screen walks through the whole product:
          form → rated → Google → private → dashboard. */}
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
                "NFC and QR table links",
                "A unique link for every table, ready to write onto a chip.",
              ],
              [
                "Smart review routing",
                "Set the score that earns a Google invite. Below it stays private.",
              ],
              [
                "One-tap reasons",
                "Guests give useful feedback without typing a word.",
              ],
              [
                "A private dashboard",
                "Ratings, comments and order numbers — visible only to you.",
              ],
              [
                "Trends over time",
                "Today, this week, this month. See whether you're improving.",
              ],
              [
                "Many restaurants",
                "Run several venues from one console. Each owner sees only their own.",
              ],
            ].map(([title, copy], i) => (
              <Reveal key={title} delay={i * 90}>
                <FeatureItem title={title}>{copy}</FeatureItem>
              </Reveal>
            ))}
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
              Sign in to your dashboard, or ask your ScoreFlow operator to set up
              your restaurant.
            </p>
            <div className="mt-9">
              <Link href="/login" className={BTN_DARK}>
                Sign in
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
          <Link
            href="/login"
            className="link-underline text-[13px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
