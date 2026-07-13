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
import {
  getFeedbackStats,
  getDailyTrend,
  getRecentFeedback,
  getTopTags,
  getReviewInviteStats,
  getReviewClicksByPlatform,
  getOpenComplaints,
  countOpenComplaints,
} from "@/lib/feedback";
import {
  hasAnyReviewLink,
  REVIEW_PLATFORMS,
  type ReviewPlatform,
} from "@/lib/review-platforms";
import {
  RANGES,
  RANGE_LABELS,
  parseRange,
  cutoffFor,
  type Range,
} from "@/lib/dashboard-range";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { logout } from "@/app/login/actions";
import ChangePassword from "./ChangePassword";
import NeedsAttention from "./NeedsAttention";
import FeedbackItem from "../FeedbackItem";
import SubscriptionLocked from "@/app/SubscriptionLocked";

/** How many recent submissions the "All submissions" list shows (pagination cap). */
const RECENT_LIMIT = 50;

// Always render on each request so the owner sees the latest feedback.
export const dynamic = "force-dynamic";

// ── Style tokens (shared look with the feedback + login pages) ────────────────
const CARD_CLASS = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const PILL_BTN_CLASS =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

/**
 * A platform id → its display name ("yelp" → "Yelp"). Falls back to the raw id, so an
 * old row written before a platform was renamed still shows *something* rather than
 * a blank in the middle of a sentence.
 */
function platformName(id: string): string {
  return (
    REVIEW_PLATFORMS.find((p) => p.id === (id as ReviewPlatform))?.name ?? id
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

  // Which time window? (defaults to "all"). Shared with the All-orders page.
  const range: Range = parseRange(sp.range);

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

  // ── BOUNDED data loading (Milestone 24) ─────────────────────────────────────
  // Previously this fetched EVERY feedback row and derived everything in memory —
  // fine at 50 responses, a multi-MB page and slow query at 10,000. Now each piece
  // is an aggregate (no rows) or a `take`-limited slice, so the dashboard's cost no
  // longer grows with the restaurant's history. All use the [restaurantId,
  // createdAt] index. The open-complaints worklist deliberately ignores the range
  // filter — an unhappy diner from last week is still waiting on you.
  const now = new Date();
  const since = cutoffFor(range, now) ?? undefined;

  const [
    stats,
    days,
    recent,
    topTags,
    reviewStats,
    openComplaints,
    openComplaintCount,
    clicksByPlatform,
  ] =
    await Promise.all([
      getFeedbackStats(restaurant.id, since),
      getDailyTrend(restaurant.id, now),
      getRecentFeedback(restaurant.id, since, RECENT_LIMIT),
      getTopTags(restaurant.id, since),
      getReviewInviteStats(restaurant.id, since),
      // The list is capped (see lib/feedback); the COUNT is the honest total, so a
      // backlog of 200 never renders as 200 cards but also never lies as "25".
      getOpenComplaints(restaurant.id, restaurant.alertThreshold),
      countOpenComplaints(restaurant.id, restaurant.alertThreshold),
      // Which platform diners actually chose (M29).
      getReviewClicksByPlatform(restaurant.id, since),
    ]);

  // Has this restaurant set a review link on ANY platform? Drives both the
  // "nobody is being invited anywhere" warning and whether the ROI card renders.
  const hasReviewLink = hasAnyReviewLink(restaurant);

  const total = stats.total;
  const averageRating = stats.average;

  // "Are we improving?" — compare this window's average to the SAME-length window
  // immediately before it (a separate bounded aggregate, not rows in memory).
  let delta: number | null = null;
  if (since) {
    const windowMs = now.getTime() - since.getTime();
    const prevStart = new Date(since.getTime() - windowMs);
    const prev = await getFeedbackStats(restaurant.id, prevStart, since);
    if (averageRating !== null && prev.average !== null) {
      delta = averageRating - prev.average;
    }
  }

  // Review-invite conversion — the ROI number (M24). Only meaningful once a Google
  // link is set (otherwise nobody is being invited).
  const reviewRatePct =
    reviewStats.invited > 0
      ? Math.round((reviewStats.clicked / reviewStats.invited) * 100)
      : null;

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Header (reorganised M31).
            Row 1: who you are + the SESSION control. Sign out is pulled out to the
            top-right corner and coloured red — it's the one destructive/exit action,
            so it shouldn't sit in the middle of the neutral navigation pills where it's
            easy to hit by accident.
            Row 2: the navigation actions (where you go), including the new All orders. */}
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                {restaurant.name}
              </h1>
              <p className="text-sm text-[#6B7280]">Feedback dashboard</p>
            </div>
            <div className="flex flex-none items-center gap-3">
              <span className="hidden text-sm text-[#9CA3AF] sm:inline">
                {access.ownerEmail}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/r/${slug}/orders`} className={PILL_BTN_CLASS}>
              All orders
            </Link>
            <Link href={`/r/${slug}/tables`} className={PILL_BTN_CLASS}>
              Tables &amp; QR
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
          </div>
        </header>

        {/* The silent-failure warning (M18, widened in M29). With no review link at
            all, a diner used to tap a button that went nowhere and nobody ever found
            out. Now no button is shown — and we tell the owner, who can fix it in one
            click.

            ⚠️ The test is "no link on ANY platform", not "no Google link". An owner who
            has deliberately chosen Tripadvisor-only is not misconfigured, and nagging
            them about Google would be us being wrong, loudly, on their dashboard. */}
        {!hasReviewLink && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <b>No review links set.</b> Your guests aren&apos;t being invited to
              review you anywhere, so you&apos;re not getting any new reviews.{" "}
              <Link
                href={`/r/${slug}/settings`}
                className="font-semibold underline"
              >
                Add your links
              </Link>
              .
            </p>
          </div>
        )}

        {/* Needs attention — the unhappy diners still waiting on someone. */}
        <NeedsAttention
          slug={slug}
          complaints={openComplaints}
          totalOpen={openComplaintCount}
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
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          {/* Review-invite ROI (M24; per-platform in M29). This is the number that
              answers "what am I paying for?" — how many diners we invited actually
              went. Shown once ANY review link is set, and broken down by platform, so
              the owner can see which one is worth keeping and which is dead weight. */}
          {hasReviewLink && (
            <div className={`col-span-2 sm:col-span-1 ${CARD_CLASS}`}>
              {/* "Reviews left" was ambiguous — it reads as "reviews REMAINING", not
                  "reviews they left", and sitting above a percentage it was actively
                  confusing. This is a click-through rate; say so. */}
              <div className="text-sm text-[#6B7280]">Tapped through</div>
              <div className="mt-1 text-3xl font-bold text-[#111827]">
                {reviewRatePct === null ? "—" : `${reviewRatePct}%`}
              </div>
              <div className="mt-1 text-xs text-[#9CA3AF]">
                {reviewStats.clicked} of {reviewStats.invited} guests invited
              </div>
              {clicksByPlatform.length > 0 && (
                <div className="mt-2 text-xs text-[#6B7280]">
                  {clicksByPlatform
                    .map((c) => `${platformName(c.platform)} ${c.count}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          )}
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
              {topTags.map(({ tag, count }) => (
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

        {/* Recent feedback.
            NOTE (M31): the old "Lowest-rated orders" section was REMOVED. With only
            good ratings it proudly listed 8s and 9s as your "lowest-rated", which read
            like a problem when it wasn't — and it duplicated "Needs attention" (the real
            worklist of unhappy diners). "Show me my worst" now lives on the All-orders
            page, which sorts by rating across the WHOLE history, not just the last few. */}
        {total === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-[#6B7280]">
            No feedback in this period. Try a different range, or submissions from
            the customer form will show up here.
          </p>
        ) : (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#111827]">
                Recent feedback
              </h2>
              {/* The dashboard shows a live snapshot; the full, paginated history —
                  with sort — is one tap away. */}
              <Link
                href={`/r/${slug}/orders`}
                className="flex-none text-sm font-medium text-amber-600 hover:underline"
              >
                All orders →
              </Link>
            </div>
            {total > RECENT_LIMIT && (
              <p className="mb-3 text-sm text-[#9CA3AF]">
                Showing the {RECENT_LIMIT} most recent of {total} in this period.{" "}
                <Link href={`/r/${slug}/orders`} className="font-medium underline">
                  See all
                </Link>
                .
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {recent.map((r) => (
                <FeedbackItem key={r.id} record={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
