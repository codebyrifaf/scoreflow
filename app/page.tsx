/**
 * Marketing landing page, served at `/` (Milestone 12).
 *
 * A static SERVER component (no client JS needed — just markup + links) in the
 * app's premium white theme. Sections: nav, hero (with a product mock), a stat
 * strip, "how it works", features, the review-routing highlight, a final CTA,
 * and a footer. Sign-in is the only CTA because restaurants are onboarded by an
 * operator (there's no public sign-up yet).
 */

import Link from "next/link";

/** The brand wordmark: an amber disc + "ScoreFlow". */
function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white">
        S
      </span>
      <span className="text-lg font-bold tracking-tight text-[#111827]">
        ScoreFlow
      </span>
    </div>
  );
}

/** A small feature card. */
function Feature({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-xl">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[#6B7280]">
        {children}
      </p>
    </div>
  );
}

/** A numbered "how it works" step. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white">
        {n}
      </div>
      <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
      <p className="text-[15px] leading-relaxed text-[#6B7280]">{children}</p>
    </div>
  );
}

/** A small product mock of the customer feedback card, for the hero. */
function ProductMock() {
  const ratings = [6, 7, 8, 9, 10];
  return (
    <div className="mx-auto w-full max-w-xs rounded-4xl border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_60px_-20px_rgba(17,24,39,0.25)]">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-xl font-bold text-white">
          F
        </span>
        <span className="text-base font-bold text-[#111827]">Fucco</span>
        <span className="rounded-full border border-[#E5E7EB] px-2.5 py-0.5 text-xs font-medium text-[#6B7280]">
          Table 7
        </span>
      </div>
      <p className="mt-5 text-sm font-semibold text-[#111827]">
        How was your meal?
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {ratings.map((r) => (
          <div
            key={r}
            className={`flex aspect-square items-center justify-center rounded-xl text-sm font-semibold ${
              r === 9
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                : "bg-[#F3F4F6] text-[#111827]"
            }`}
          >
            {r}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-green-500 px-4 py-3 text-center text-sm font-semibold text-white">
        Leave us a Google review ★
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="font-system min-h-dvh w-full bg-white text-[#111827]">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[#F3F4F6] bg-white/80 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Wordmark />
          <Link
            href="/login"
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-105 bg-linear-to-b from-amber-50 to-white"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              For restaurants
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-[#111827] sm:text-5xl">
              Turn happy diners into{" "}
              <span className="text-amber-500">5-star reviews.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#6B7280]">
              ScoreFlow collects feedback right at the table, sends happy guests
              to Google, and quietly routes complaints to you — before they ever
              go public.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
              >
                Sign in
              </Link>
              <Link
                href="#how"
                className="rounded-2xl border border-[#E5E7EB] px-6 py-3.5 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-sm text-[#9CA3AF]">
              10-second feedback · No app to download · Works on any phone
            </p>
          </div>

          <div className="lg:justify-self-end">
            <ProductMock />
          </div>
        </div>
      </section>

      {/* ── Stat strip ──────────────────────────────────────────────────────── */}
      <section className="border-y border-[#F3F4F6] bg-[#FAFAFA]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-5 py-10 text-center sm:grid-cols-3">
          {[
            ["1–10", "Simple rating scale guests actually finish"],
            ["Tap", "NFC chips (or QR) — no app, no friction"],
            ["Private", "Bad experiences reach you, not Google"],
          ].map(([big, small]) => (
            <div key={big}>
              <div className="text-3xl font-bold tracking-tight text-[#111827]">
                {big}
              </div>
              <div className="mt-1 text-sm text-[#6B7280]">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827]">
            How it works
          </h2>
          <p className="mt-3 text-lg text-[#6B7280]">
            Three steps between a finished meal and a better reputation.
          </p>
        </div>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <Step n={1} title="Tap to rate">
            A guest taps the NFC chip on the table (or scans a QR), then rates
            their meal in seconds — no app, no sign-up.
          </Step>
          <Step n={2} title="Smart routing">
            Happy guests are invited to leave a Google review. Unhappy ones reach
            a private &ldquo;tell us what went wrong&rdquo; screen instead.
          </Step>
          <Step n={3} title="Act on insights">
            You see ratings, trends, and what guests mention most — all in one
            clean dashboard.
          </Step>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="border-y border-[#F3F4F6] bg-[#FAFAFA]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-[#111827]">
              Everything you need
            </h2>
            <p className="mt-3 text-lg text-[#6B7280]">
              Built to grow your reviews and protect your reputation.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon="📲" title="NFC & QR table links">
              A unique link per table, ready to write onto an NFC chip or print as
              a QR code.
            </Feature>
            <Feature icon="🎯" title="Smart review routing">
              Set a threshold per restaurant — great ratings go to Google, low
              ones stay private.
            </Feature>
            <Feature icon="⚡" title="One-tap feedback">
              Quick-tap suggestion chips mean guests give useful feedback without
              typing a word.
            </Feature>
            <Feature icon="📊" title="Private dashboard">
              Totals, averages, lowest-rated orders, and the exact order numbers —
              only you can see it.
            </Feature>
            <Feature icon="📈" title="Trends over time">
              Filter by today, week, or month and see whether you&apos;re
              improving at a glance.
            </Feature>
            <Feature icon="🏬" title="Multi-restaurant">
              Manage many restaurants from one operator console — each owner sees
              only their own.
            </Feature>
          </div>
        </div>
      </section>

      {/* ── Review-routing highlight ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="rounded-4xl border border-[#E5E7EB] bg-white p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[#111827]">
                Protect your reputation, automatically.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[#6B7280]">
                Most feedback tools blast every rating to Google. ScoreFlow is
                smarter: it nudges your happiest guests to review you publicly,
                and gives unhappy guests a private way to reach you — so you can
                make it right before it becomes a 1-star.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center gap-4 rounded-2xl bg-green-50 p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-green-500 text-lg font-bold text-white">
                  9
                </span>
                <div>
                  <div className="font-semibold text-[#111827]">Happy guest</div>
                  <div className="text-sm text-[#6B7280]">
                    → invited to leave a Google review
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-red-50 p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-red-500 text-lg font-bold text-white">
                  3
                </span>
                <div>
                  <div className="font-semibold text-[#111827]">
                    Unhappy guest
                  </div>
                  <div className="text-sm text-[#6B7280]">
                    → private feedback, straight to you
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="border-t border-[#F3F4F6] bg-[#FAFAFA]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Ready to grow your reviews?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-[#6B7280]">
            Sign in to your dashboard, or ask your ScoreFlow operator to get your
            restaurant set up.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-2xl bg-amber-500 px-8 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#F3F4F6]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-[#9CA3AF] sm:flex-row">
          <Wordmark />
          <span>© {new Date().getFullYear()} ScoreFlow</span>
          <Link href="/login" className="font-medium text-[#6B7280] hover:text-[#111827]">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
