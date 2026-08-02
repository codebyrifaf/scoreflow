/**
 * The sales deck — served at `/pitch`.
 *
 * Eight slides an owner can understand without effort. The landing page is written
 * for someone already curious enough to read; a social feed gives you one image and
 * about two seconds, so this is the same product told in pictures.
 *
 * ── The rules this page is built on ──────────────────────────────────────────
 *
 * 1. ONE IDEA PER SLIDE, and a hard cap of roughly fifteen words of body text.
 *    That cap is the brief, not a style preference. A slide that needs a paragraph
 *    should be two slides.
 *
 * 2. ⚠️ NO FABRICATED PROOF. No testimonials, no invented statistics, no customer
 *    logos, no "restaurants get 30% more reviews". This has been the marketing
 *    site's rule since M40 and it matters more here than anywhere: the product's
 *    entire differentiator is that it does NOT fake your reviews. A deck with
 *    invented praise on it would refute the thing it is selling. The numbers below
 *    are plainly a screenshot of an example — internally consistent, never a claim
 *    about anyone's results.
 *
 * 3. EVERYTHING IS THE REAL PRODUCT. The QR is genuinely scannable, the platform
 *    logos come from `REVIEW_PLATFORMS`, and the screens are built from the same
 *    tokens as the app. Marketing that is generated separately from the product
 *    drifts away from it — which is exactly what happened to the landing page twice
 *    (M23, M40) and again this week.
 *
 * ── Using it ─────────────────────────────────────────────────────────────────
 * Every slide is a fixed 4:5 card (see Slide.tsx), so a screenshot is a finished
 * social post. "Print / Save as PDF" gives one slide per page for a leave-behind.
 * No image library, no PDF library — the browser is the renderer, the same call
 * M30 made for the QR kit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import PhoneFrame from "@/app/PhoneFrame";
import QrCode from "@/app/QrCode";
import PrintButton from "@/app/r/[slug]/tables/print/PrintButton";
import Slide, {
  SlideBody,
  SlideKicker,
  SlideTitle,
  SlideVisual,
} from "./Slide";
import { BTN_DARK, TRIAL_DAYS } from "@/app/landing/tokens";
import { TapWaves } from "@/app/landing/SetupStrip";
import { REVIEW_PLATFORMS } from "@/lib/review-platforms";
import { appUrl } from "@/lib/app-url";
import { qrMatrix } from "@/lib/qr";

/** Placeholder pricing, same source of truth as the landing page's constants. */
const PRICE = 29;

export const metadata: Metadata = {
  title: "ScoreFlow in eight slides",
  description:
    "Find out a guest is unhappy while they're still at the table — and which dish it was.",
  // ⚠️ Deliberately not indexed. This says the same thing as the landing page in a
  // different shape; letting Google index both makes them compete for the same
  // terms and splits their ranking. It's built to be shared, not found — the same
  // treatment /operator/login gets.
  robots: { index: false, follow: false },
};

export default function PitchPage() {
  // A REAL QR, not a decorative one — the same `qrMatrix` the print kit and the
  // landing page use. Anyone can point a phone at the deck and check, and being
  // caught faking it would cost more than the slide is worth.
  const signupQr = qrMatrix(`${appUrl()}/signup`);

  return (
    <main className="font-system min-h-dvh w-full bg-[#F5F5F7] text-[#1D1D1F] antialiased">
      {/* Toolbar — screen only, never printed, never screenshotted. */}
      <div className="print:hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              ScoreFlow
            </p>
            <p className="text-[13px] text-[#6E6E73]">
              Eight slides. Screenshot any one of them to post it.
            </p>
          </div>
          <PrintButton className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:border-[#1D1D1F]" />
        </div>
      </div>

      {/* `pitch-deck` + `qr-sheet` are print classes (globals.css): on paper the grid
          collapses to one slide per page, so Save-as-PDF gives a hand-out rather than
          a contact sheet. */}
      <div className="pitch-deck qr-sheet mx-auto grid w-full max-w-5xl gap-8 px-6 pb-20 sm:grid-cols-2">
        {/* ── 1. The problem, felt rather than explained ─────────────────────
            Opens on the loss, not the product. A cold reader scrolling past has no
            reason to care what ScoreFlow is; they do care about a public one-star. */}
        <Slide n={1} tone="dark">
          <div>
            <SlideKicker dark>What happens today</SlideKicker>
            <SlideTitle className="mt-4">
              A guest hated the burger.
              <br />
              They didn&apos;t tell you.
            </SlideTitle>
            <SlideBody dark>They told Google. On Tuesday. In public.</SlideBody>
          </div>

          <SlideVisual>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-center gap-1 text-[15px] text-amber-400">
                ★<span className="text-white/25">★★★★</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                &ldquo;Burger was dry and cold. Won&apos;t be back.&rdquo;
              </p>
              <p className="mt-2 text-[12px] text-white/40">
                Posted 4 days after the meal · seen by everyone
              </p>
            </div>
          </SlideVisual>
        </Slide>

        {/* ── 2. The turn ───────────────────────────────────────────────────
            Almost no art on purpose. It's the pivot of the whole deck and it should
            read in under a second. */}
        <Slide n={2}>
          <div>
            <SlideKicker>What if instead</SlideKicker>
            <SlideTitle className="mt-4">
              You knew in
              <br />
              30 seconds.
            </SlideTitle>
            <SlideBody>While they were still sitting at the table.</SlideBody>
          </div>

          {/* No art on this one by design — it's the pivot of the deck and has to
              read in under a second — so the one line of copy carries the whole
              lower half and is sized up to fill it. */}
          <SlideVisual>
            <p className="text-[17px] font-medium leading-relaxed text-[#1D1D1F] sm:text-[19px]">
              A problem you hear about at the table is a free dessert.
              <br />
              <span className="text-[#6E6E73]">
                The same problem on Google is a one-star, forever.
              </span>
            </p>
          </SlideVisual>
        </Slide>

        {/* ── 3. How, in one picture ────────────────────────────────────────── */}
        <Slide n={3}>
          <div>
            <SlideKicker>How it works</SlideKicker>
            <SlideTitle className="mt-4">A card on the table.</SlideTitle>
            <SlideBody>
              They scan it and rate the meal out of ten. No app.
            </SlideBody>
          </div>

          <SlideVisual className="items-center gap-5">
            <div className="flex items-end justify-center gap-4">
              {/* The table card, as the print kit actually renders it. */}
              <div className="rounded-2xl border border-[#D2D2D7] bg-white p-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold text-[#1D1D1F]">
                  Table 4
                </p>
                <div className="my-1.5 flex justify-center">
                  <QrCode
                    matrix={signupQr}
                    className="h-[68px] w-[68px]"
                    title="Scan to start a free trial"
                  />
                </div>
                <p className="text-[8px] leading-tight text-[#6E6E73]">
                  How was
                  <br />
                  your meal?
                </p>
              </div>

              <PhoneFrame width="w-[132px]">
                <div className="px-2.5 py-3">
                  <p className="text-center text-[8px] font-semibold text-[#111827]">
                    How was your meal?
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <div
                        key={n}
                        className={`flex aspect-square items-center justify-center rounded-md text-[8px] font-semibold ${
                          n === 3
                            ? "bg-amber-500 text-white"
                            : "bg-[#F3F4F6] text-[#111827]"
                        }`}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["Burger was dry", "Bun soggy"].map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[7px] font-medium text-[#111827]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </PhoneFrame>
            </div>

            {/* ⚠️ NFC belongs on this slide. It is a first-class way to use ScoreFlow
                and it PREDATES the QR kit — the deck shipped without it and that was
                simply a hole, the same "marketing forgot a feature" drift M23 and M40
                each had to fix.

                It sits here as the "or", not on slide 7, on purpose: slide 7's promise
                is "nothing to buy", and chips cost money. Putting NFC there would make
                that line untrue. This is the same split the landing page already
                makes — the printed card owns "nothing to buy", NFC is the upgrade for
                anyone who'd rather tap than scan. */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#D2D2D7] bg-white/70 px-4 py-2.5">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-amber-500 text-white">
                <TapWaves className="h-4 w-4" />
              </span>
              <p className="text-[12.5px] leading-snug text-[#3A3A3C]">
                Or load the same link onto an{" "}
                <span className="font-medium text-[#1D1D1F]">NFC chip</span> — they
                tap, no camera.
              </p>
            </div>
          </SlideVisual>
        </Slide>

        {/* ── 4. The alert — the emotional hook ─────────────────────────────── */}
        <Slide n={4}>
          <div>
            <SlideKicker>Seconds later</SlideKicker>
            <SlideTitle className="mt-4">Your phone buzzes.</SlideTitle>
            <SlideBody>Before they&apos;ve even asked for the bill.</SlideBody>
          </div>

          <SlideVisual>
            <div className="rounded-2xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium text-[#AEAEB2]">
                ScoreFlow · now
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[#1D1D1F]">
                Table 4 rated you 3/10
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6E6E73]">
                &ldquo;Burger was dry&rdquo; · Order 102
              </p>
              <p className="mt-3 text-[13px] font-medium text-[#1D1D1F]">
                You have about four minutes.
              </p>
            </div>
          </SlideVisual>
        </Slide>

        {/* ── 5. THE SLIDE THAT CLOSES THE SALE ──────────────────────────────
            The newest feature, and the one the landing page has never mentioned. An
            alert says something is wrong; this says what to fix on Monday. */}
        <Slide n={5} tone="dark">
          <div>
            <SlideKicker dark>And the part nobody else does</SlideKicker>
            <SlideTitle className="mt-4">
              It tells you
              <br />
              which dish.
            </SlideTitle>
            <SlideBody dark>
              Your till says what they ordered. We do the rest.
            </SlideBody>
          </div>

          <SlideVisual>
            <div className="rounded-2xl bg-white p-4 text-[#1D1D1F]">
              <p className="text-[11px] text-[#6E6E73]">
                By dish · worst first
              </p>
              {[
                {
                  dish: "Chicken Burger",
                  score: "4.2",
                  tone: "text-red-600",
                  chips: "Dry ×7 · Cold ×4",
                },
                {
                  dish: "Fries",
                  score: "8.8",
                  tone: "text-green-600",
                  chips: "Crispy ×9",
                },
              ].map((r) => (
                <div
                  key={r.dish}
                  className="mt-2.5 flex items-start justify-between gap-3 border-t border-[#F3F4F6] pt-2.5 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{r.dish}</p>
                    <p className="mt-0.5 text-[11px] text-[#6E6E73]">
                      {r.chips}
                    </p>
                  </div>
                  <span className={`text-[17px] font-bold ${r.tone}`}>
                    {r.score}
                  </span>
                </div>
              ))}
              {/* Says plainly that this is an example, so no number here can be read
                as a claim about a real restaurant's results. */}
              <p className="mt-3 text-[10px] text-[#AEAEB2]">
                Example dashboard
              </p>
            </div>
          </SlideVisual>
        </Slide>

        {/* ── 6. The differentiator a competitor can't copy ──────────────────
            Shown as a picture rather than argued in prose — M40 compressed the same
            ~90-word compliance wall into one image for exactly this reason. */}
        <Slide n={6}>
          <div>
            <SlideKicker>Why you can trust it</SlideKicker>
            <SlideTitle className="mt-4">
              Every guest gets
              <br />
              the review link.
            </SlideTitle>
            <SlideBody>
              Even the unhappy one. That&apos;s the law here.
            </SlideBody>
          </div>

          <SlideVisual>
            <div className="flex flex-wrap items-center gap-2">
              {REVIEW_PLATFORMS.map((p) => (
                <span
                  key={p.id}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D2D2D7] bg-white"
                >
                  {/* Local SVG — the M25 CSP is `img-src 'self'`, so a CDN logo would
                      be silently blocked. Decorative; the point is made in text. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.logo}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#6E6E73]">
              Tools that hide it from unhappy guests break Google&apos;s rules
              and UK review law.{" "}
              <span className="font-medium text-[#1D1D1F]">
                We never hide it.
              </span>
            </p>
          </SlideVisual>
        </Slide>

        {/* ── 7. Kill the "this sounds like hassle" objection ────────────────── */}
        <Slide n={7}>
          <div>
            <SlideKicker>Setting up</SlideKicker>
            <SlideTitle className="mt-4">Nothing to buy.</SlideTitle>
            <SlideBody>Print the cards, put them out. Live tonight.</SlideBody>
          </div>

          <SlideVisual>
            <ol className="flex flex-col gap-2.5">
              {[
                "Add your restaurant",
                "Print the cards we make for you",
                "Put one on each table",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#1D1D1F] text-[12px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-[#1D1D1F]">{step}</span>
                </li>
              ))}
            </ol>
          </SlideVisual>
        </Slide>

        {/* ── 8. The close ──────────────────────────────────────────────────── */}
        <Slide n={8} tone="dark">
          <div>
            <SlideKicker dark>Try it</SlideKicker>
            <SlideTitle className="mt-4">
              £{PRICE} a month.
              <br />
              {TRIAL_DAYS} days free.
            </SlideTitle>
            <SlideBody dark>
              No card. Cancel whenever. Prices exclude VAT.
            </SlideBody>
          </div>

          <SlideVisual>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-white">
                  Scan to start
                </p>
                <p className="mt-1 text-[12px] text-white/50">
                  The next unhappy guest
                  <br />
                  tells you, not Google.
                </p>
              </div>
              <div className="rounded-xl bg-white p-2">
                {/* 84px+ so a phone can actually read it off a screen. M40 learned this
                  the hard way: a 78px code decoded in a test and was fiddly in life. */}
                <QrCode
                  matrix={signupQr}
                  className="h-[84px] w-[84px]"
                  title="Scan to start a free trial"
                />
              </div>
            </div>
          </SlideVisual>
        </Slide>
      </div>

      {/* Screen-only footer. */}
      <div className="print:hidden">
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 text-center">
          <Link href="/signup" className={BTN_DARK}>
            Start {TRIAL_DAYS} days free
          </Link>
          <p className="mt-4 text-[13px] text-[#6E6E73]">
            Screenshot any slide to post it, or use Print / Save as PDF for a
            hand-out.
          </p>
        </div>
      </div>
    </main>
  );
}
