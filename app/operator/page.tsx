/**
 * The OPERATOR's sales dashboard, served at `/operator` (Milestone 21).
 *
 * This is the business cockpit — the operator is the person SELLING ScoreFlow, so
 * this answers: how many restaurants signed up, how many are paying, how much money
 * came in, and which customers are about to churn.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  It shows COUNTS and MONEY. It never shows a customer's FEEDBACK.          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Deliberately absent: average rating, comments, anything a diner wrote. The
 * operator cannot open any owner's dashboard (the guards refuse them), and this
 * page keeps that promise on the data side too — see lib/operator-stats.ts. It's
 * also the product's strongest trust claim to a suspicious restaurant owner:
 * "even I can't read your complaints."
 *
 * PROTECTED by `requireOperator()`, which re-reads the account from the database on
 * every request (M17) and sends signed-out visitors to /operator/login.
 */

import Link from "next/link";
import { requireOperator } from "@/lib/auth-guard";
import { getSalesOverview, getSignupTrend } from "@/lib/operator-stats";
import { logout } from "@/app/login/actions";
import { formatGbp } from "@/lib/money";

export const dynamic = "force-dynamic";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white p-5";
const PILL =
  "rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]";


/** Shown if a signed-in NON-operator (an owner) somehow lands here. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#0F172A]">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#64748B]">This area is for ScoreFlow operators only.</p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-deep"
      >
        Go back
      </Link>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-[#0F172A]";
  return (
    <div className={CARD}>
      <div className="text-sm text-[#64748B]">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-[#94A3B8]">{hint}</div>}
    </div>
  );
}

export default async function OperatorPage() {
  // ── SECURITY GATE ──────────────────────────────────────────────────────────
  const access = await requireOperator();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  // The full customer LIST now lives on /operator/customers (M33) — the dashboard
  // just needs the summary + the count, so we no longer load every account here.
  const [overview, trend] = await Promise.all([
    getSalesOverview(),
    getSignupTrend(30),
  ]);

  const peak = Math.max(1, ...trend.map((d) => d.count));

  return (
    <main className="font-system min-h-dvh w-full bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
              Operator
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Sales &amp; growth
            </h1>
          </div>
          <div className="flex flex-none items-center gap-3">
            <span className="hidden text-sm text-[#94A3B8] sm:inline">
              {access.operatorEmail}
            </span>
            <Link href="/operator/customers" className={PILL}>
              Customers
            </Link>
            {/* Sign out — red, set apart from the neutral pills (matches the owner
                dashboard, M31). */}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* The money */}
        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Paying customers"
            value={overview.active}
            hint={
              overview.conversionPct !== null
                ? `${overview.conversionPct}% of signups convert`
                : undefined
            }
            tone={overview.active > 0 ? "good" : undefined}
          />
          <Stat
            label="Monthly revenue"
            value={formatGbp(overview.mrrPence)}
            hint="from active subscriptions"
          />
          <Stat
            label="Collected (30d)"
            value={formatGbp(overview.revenue30d)}
            hint={`${formatGbp(overview.revenueTotal)} all time`}
          />
          <Stat
            label="On trial"
            value={overview.trialing}
            hint={`${overview.signups30d} new in 30d`}
          />
        </section>

        {/* The warnings */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Lapsed"
            value={overview.lapsed}
            hint="trial ended or suspended"
            tone={overview.lapsed > 0 ? "bad" : undefined}
          />
          <Stat label="Total accounts" value={overview.totalAccounts} />
          <Stat
            label="Comped"
            value={overview.comped}
            hint="created by you, not billed"
          />
        </section>

        {/* Signups over time — hand-rolled bars, no chart library. */}
        <section className={`${CARD} mb-8`}>
          <h2 className="text-lg font-semibold">Signups — last 30 days</h2>
          <p className="mb-4 text-sm text-[#64748B]">
            {overview.signups30d} new{" "}
            {overview.signups30d === 1 ? "restaurant" : "restaurants"} found you.
          </p>
          <div className="flex h-24 items-end gap-1">
            {trend.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-aqua-500 transition-all"
                style={{
                  height: `${(d.count / peak) * 100}%`,
                  minHeight: d.count > 0 ? "4px" : "2px",
                  opacity: d.count > 0 ? 1 : 0.12,
                }}
                title={`${d.label}: ${d.count} signup${d.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#94A3B8]">
            <span>{trend[0]?.label}</span>
            <span>{trend[trend.length - 1]?.label}</span>
          </div>
        </section>

        {/* The customers — the full list (filter / sort / pagination + the
            record-payment and support-tools actions) lives on its own page now (M33),
            so this dashboard stays a scannable snapshot. */}
        <section>
          <Link
            href="/operator/customers"
            className={`${CARD} flex items-center justify-between gap-4 transition-colors hover:bg-[#F8FAFC]`}
          >
            <div>
              <h2 className="text-lg font-semibold">
                Customers ({overview.totalAccounts})
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Record payments, filter by status, and spot churn — open the full list.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex-none text-lg font-semibold text-[#64748B]"
            >
              →
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
