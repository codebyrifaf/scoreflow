/**
 * Owner dashboard, served at `/r/[slug]/dashboard` (e.g. /r/fucco/dashboard).
 *
 * SERVER component. It's PROTECTED (see the guard below), scoped to ONE
 * restaurant, and shows a summary + trend + the feedback lists for that
 * restaurant only. Milestone 9 added time filters (All / Today / Week / Month),
 * an "are we improving?" trend, quick-tap tag display + top mentions, and the
 * premium white ("Apple") redesign matching the customer + login pages.
 *
 * Data isolation: `getFeedbackForRestaurant(restaurant.id)` filters by
 * `restaurantId`, so this page can only ever show this restaurant's feedback.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { getFeedbackForRestaurant, getOpenComplaints } from "@/lib/feedback";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { logout } from "@/app/login/actions";
import ChangePassword from "./ChangePassword";
import NeedsAttention from "./NeedsAttention";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import type { FeedbackRecord } from "@/lib/types";

// Always render on each request so the owner sees the latest feedback.
export const dynamic = "force-dynamic";

// ── Style tokens (shared look with the feedback + login pages) ────────────────
const CARD_CLASS = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const PILL_BTN_CLASS =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

// ── Time-range filter ─────────────────────────────────────────────────────────
type Range = "all" | "today" | "week" | "month";
const RANGES: Range[] = ["all", "today", "week", "month"];
const RANGE_LABELS: Record<Range, string> = {
  all: "All",
  today: "Today",
  week: "Week",
  month: "Month",
};

/** The earliest timestamp to include for a range (null = no limit / all time). */
function cutoffFor(range: Range, now: number): Date | null {
  if (range === "all") return null;
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0); // since midnight today
    return d;
  }
  const days = range === "week" ? 7 : 30; // rolling 7 / 30 days
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

/** Average rating of a list, or null when it's empty. */
function averageOf(list: FeedbackRecord[]): number | null {
  if (list.length === 0) return null;
  return list.reduce((sum, r) => sum + r.rating, 0) / list.length;
}

/** A readable timestamp, e.g. "7/6/2026, 5:03:35 PM". */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Colour a rating so an owner can scan good/ok/bad at a glance. */
function ratingTone(rating: number): string {
  if (rating >= 8) return "bg-green-50 text-green-700";
  if (rating >= 5) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

/** One feedback submission as a clean, mobile-friendly card (replaces the table). */
function FeedbackItem({ record }: { record: FeedbackRecord }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#E5E7EB] p-4">
      <div
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold ${ratingTone(
          record.rating
        )}`}
      >
        {record.rating}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[#111827]">
            Order {record.orderNumber}
            <span className="font-normal text-[#6B7280]">
              {" · "}Table {record.table ?? "—"}
            </span>
          </span>
          <span className="flex-none text-xs text-[#9CA3AF]">
            {formatTimestamp(record.timestamp)}
          </span>
        </div>
        {record.comment && (
          <p className="mt-1 text-sm text-[#374151]">{record.comment}</p>
        )}
        {record.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shown when a signed-in user opens a branch dashboard they can't access. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">
        You&apos;re signed in, but this dashboard isn&apos;t one you can view.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
      >
        Go back
      </Link>
    </main>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  // Which time window? (defaults to "all"). searchParams values can be arrays.
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range: Range = RANGES.includes(rawRange as Range)
    ? (rawRange as Range)
    : "all";

  // ── SECURITY GATE ───────────────────────────────────────────────────────────
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return access.reason === "subscription" ? (
      <SubscriptionLocked state={access.state} />
    ) : (
      <NotAuthorized homeHref={access.homeHref} />
    );
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    notFound();
  }

  // Fetch ALL feedback once, then derive each view in memory (volumes are small).
  // The open-complaints worklist is a separate, indexed query (M18) — it ignores
  // the time-range filter on purpose: an unhappy diner from last week is still
  // waiting on you, and hiding them behind a "Today" tab would defeat the point.
  const [all, openComplaints] = await Promise.all([
    getFeedbackForRestaurant(restaurant.id),
    getOpenComplaints(restaurant.id, restaurant.alertThreshold),
  ]);
  const now = Date.now();
  const since = cutoffFor(range, now);

  // Feedback within the selected window.
  const current = since
    ? all.filter((f) => new Date(f.timestamp).getTime() >= since.getTime())
    : all;

  const total = current.length;
  const averageRating = averageOf(current);

  // "Are we improving?" — compare this window's average to the SAME-length window
  // immediately before it. Only meaningful for a specific range with data in both.
  let delta: number | null = null;
  if (since) {
    const length = now - since.getTime();
    const prevStart = since.getTime() - length;
    const prev = all.filter((f) => {
      const t = new Date(f.timestamp).getTime();
      return t >= prevStart && t < since.getTime();
    });
    const a = averageOf(current);
    const p = averageOf(prev);
    if (a !== null && p !== null) delta = a - p;
  }

  // Derived lists (copy before sorting so they don't interfere).
  const lowestRated = [...current].sort((a, b) => a.rating - b.rating).slice(0, 5);
  const mostRecentFirst = [...current].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Top mentions (most-picked quick-tap tags) within the window.
  const tagCounts = new Map<string, number>();
  for (const f of current) {
    for (const tag of f.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Last-7-days daily-average trend (always the last 7 days, from ALL feedback).
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, idx) => {
    const i = 6 - idx; // 6 days ago → today
    const dayStart = startToday.getTime() - i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const items = all.filter((f) => {
      const t = new Date(f.timestamp).getTime();
      return t >= dayStart && t < dayEnd;
    });
    return {
      label: new Date(dayStart).toLocaleDateString(undefined, {
        weekday: "narrow",
      }),
      avg: averageOf(items),
      count: items.length,
    };
  });

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {restaurant.name}
            </h1>
            <p className="text-sm text-[#6B7280]">Feedback dashboard</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/r/${slug}/tables`} className={PILL_BTN_CLASS}>
              Tables &amp; NFC links
            </Link>
            <Link href={`/r/${slug}/settings`} className={PILL_BTN_CLASS}>
              Settings
            </Link>
            {/* The ACCOUNT OWNER's way to grow (M22). A one-location owner is routed
                straight here and never sees the multi-location console, so without
                this link they had no way to add a second restaurant at all. A branch
                manager doesn't get it — it isn't their account. */}
            {access.isAccountOwner && access.accountSlug && (
              <Link href={`/b/${access.accountSlug}`} className={PILL_BTN_CLASS}>
                + Add location
              </Link>
            )}
            <ChangePassword />
            <span className="text-sm text-[#9CA3AF]">{access.ownerEmail}</span>
            <form action={logout}>
              <button type="submit" className={PILL_BTN_CLASS}>
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* The silent-failure warning (M18). With no Google link set, a happy diner
            used to tap a button that went nowhere and nobody ever found out. Now the
            button isn't shown at all — and we tell the owner, who can fix it
            themselves in one click. */}
        {!restaurant.googleReviewUrl && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <b>No Google review link set.</b> Happy diners aren&apos;t being sent
              anywhere, so you&apos;re not getting any new reviews.{" "}
              <Link
                href={`/r/${slug}/settings`}
                className="font-semibold underline"
              >
                Add your link
              </Link>
              .
            </p>
          </div>
        )}

        {/* Needs attention — the unhappy diners still waiting on someone. */}
        <NeedsAttention
          slug={slug}
          complaints={openComplaints}
          alertThreshold={restaurant.alertThreshold}
        />

        {/* Time-range segmented control */}
        <div className="mb-6 inline-flex rounded-full bg-[#F3F4F6] p-1 text-sm">
          {RANGES.map((r) => {
            const activeTab = r === range;
            return (
              <Link
                key={r}
                href={`/r/${slug}/dashboard?range=${r}`}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                  activeTab
                    ? "bg-white text-[#111827] shadow-sm"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {RANGE_LABELS[r]}
              </Link>
            );
          })}
        </div>

        {/* Summary cards */}
        <section className="mb-4 grid grid-cols-2 gap-3">
          <div className={CARD_CLASS}>
            <div className="text-sm text-[#6B7280]">Total responses</div>
            <div className="mt-1 text-3xl font-bold text-[#111827]">{total}</div>
          </div>
          <div className={CARD_CLASS}>
            <div className="text-sm text-[#6B7280]">Average rating</div>
            <div className="mt-1 text-3xl font-bold text-[#111827]">
              {averageRating === null
                ? "—"
                : `${averageRating.toFixed(1)} / 10`}
            </div>
            {delta !== null && (
              <div
                className={`mt-1 text-xs font-medium ${
                  delta >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} vs previous
              </div>
            )}
          </div>
        </section>

        {/* Trend — last 7 days daily average */}
        <section className={`mb-4 ${CARD_CLASS}`}>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-[#6B7280]">
              Daily average — last 7 days
            </span>
            <span className="text-xs text-[#9CA3AF]">out of 10</span>
          </div>
          <div className="flex h-24 items-end gap-2">
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-amber-500"
                    style={{
                      height: d.avg !== null ? `${(d.avg / 10) * 100}%` : "3px",
                      opacity: d.avg !== null ? 1 : 0.15,
                    }}
                    title={
                      d.avg !== null
                        ? `${d.avg.toFixed(1)} avg (${d.count} response${
                            d.count === 1 ? "" : "s"
                          })`
                        : "No feedback"
                    }
                  />
                </div>
                <span className="text-[10px] text-[#9CA3AF]">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top mentions (quick-tap tags) */}
        {topTags.length > 0 && (
          <section className={`mb-8 ${CARD_CLASS}`}>
            <div className="mb-3 text-sm text-[#6B7280]">Top mentions</div>
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#F3F4F6] px-3 py-1 text-sm font-medium text-[#111827]"
                >
                  {tag} <span className="text-[#9CA3AF]">×{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Feedback lists */}
        {total === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-[#6B7280]">
            No feedback in this period. Try a different range, or submissions from
            the customer form will show up here.
          </p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-[#111827]">
                Lowest-rated orders
              </h2>
              <div className="flex flex-col gap-2">
                {lowestRated.map((r) => (
                  <FeedbackItem key={r.id} record={r} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-[#111827]">
                All submissions ({total})
              </h2>
              <div className="flex flex-col gap-2">
                {mostRecentFirst.map((r) => (
                  <FeedbackItem key={r.id} record={r} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
