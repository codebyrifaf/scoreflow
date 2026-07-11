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
import {
  getSalesOverview,
  getAccountsForOperator,
  getSignupTrend,
} from "@/lib/operator-stats";
import { logout } from "@/app/login/actions";
import { formatGbp } from "@/lib/money";
import OperatorAccounts from "./OperatorAccounts";

export const dynamic = "force-dynamic";

const CARD = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const PILL =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";


/** Shown if a signed-in NON-operator (an owner) somehow lands here. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">This area is for ScoreFlow operators only.</p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600"
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
        : "text-[#111827]";
  return (
    <div className={CARD}>
      <div className="text-sm text-[#6B7280]">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-[#9CA3AF]">{hint}</div>}
    </div>
  );
}

export default async function OperatorPage() {
  // ── SECURITY GATE ──────────────────────────────────────────────────────────
  const access = await requireOperator();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  const [overview, accounts, trend] = await Promise.all([
    getSalesOverview(),
    getAccountsForOperator(),
    getSignupTrend(30),
  ]);

  const peak = Math.max(1, ...trend.map((d) => d.count));

  return (
    <main className="font-system min-h-dvh w-full bg-[#FAFAFA] text-[#111827]">
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              Operator
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Sales &amp; growth
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* No "manage accounts" link — there is nothing to manage (M22). The old
                /admin area is retired: restaurants sign themselves up, change their
                own settings, reset their own passwords, and close their own
                accounts. This console is sales-only. */}
            <span className="text-sm text-[#9CA3AF]">{access.operatorEmail}</span>
            <form action={logout}>
              <button type="submit" className={PILL}>
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
          <p className="mb-4 text-sm text-[#6B7280]">
            {overview.signups30d} new{" "}
            {overview.signups30d === 1 ? "restaurant" : "restaurants"} found you.
          </p>
          <div className="flex h-24 items-end gap-1">
            {trend.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-[#111827] transition-all"
                style={{
                  height: `${(d.count / peak) * 100}%`,
                  minHeight: d.count > 0 ? "4px" : "2px",
                  opacity: d.count > 0 ? 1 : 0.12,
                }}
                title={`${d.label}: ${d.count} signup${d.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#9CA3AF]">
            <span>{trend[0]?.label}</span>
            <span>{trend[trend.length - 1]?.label}</span>
          </div>
        </section>

        {/* The customers */}
        <section>
          <h2 className="mb-1 text-lg font-semibold">
            Customers ({accounts.length})
          </h2>
          <p className="mb-4 text-sm text-[#6B7280]">
            Record a payment here and their account switches on.
            &ldquo;Last used&rdquo; turns red when an account has gone quiet — that&apos;s
            your churn warning.
          </p>
          <OperatorAccounts accounts={accounts} />
        </section>
      </div>
    </main>
  );
}
