/**
 * All orders — `/r/[slug]/orders` (Milestone 31).
 *
 * The dashboard only ever showed the 50 most recent submissions, with no way to reach
 * anything older — so a busy restaurant's history was effectively lost past the cap.
 * This is the full, paginated list: every submission, in numbered pages, with a sort
 * (newest / lowest / highest) and the same time-range filter as the dashboard.
 *
 * SERVER component, guarded exactly like the dashboard (`requireDashboardAccess`):
 * owner-only, subscription-locked for a lapsed trial, scoped to this one restaurant.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { getFeedbackStats, getFeedbackPage, type FeedbackSort } from "@/lib/feedback";
import {
  RANGES,
  RANGE_LABELS,
  parseRange,
  cutoffFor,
  type Range,
} from "@/lib/dashboard-range";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import FeedbackItem from "../FeedbackItem";

export const dynamic = "force-dynamic";

/** Rows per page. */
const PAGE_SIZE = 25;

const SORTS: FeedbackSort[] = ["newest", "lowest", "highest"];
const SORT_LABELS: Record<FeedbackSort, string> = {
  newest: "Newest",
  lowest: "Lowest rating",
  highest: "Highest rating",
};

function parseSort(raw: string | string[] | undefined): FeedbackSort {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SORTS.includes(v as FeedbackSort) ? (v as FeedbackSort) : "newest";
}

/** Same clean 403 the dashboard uses. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">
        You&apos;re signed in, but these orders aren&apos;t ones you can view.
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

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    range?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const range: Range = parseRange(sp.range);
  const sort = parseSort(sp.sort);
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const requestedPage = Math.max(1, Math.floor(Number(rawPage)) || 1);

  // ── SECURITY GATE — before any data loads ───────────────────────────────────
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return access.reason === "subscription" ? (
      <SubscriptionLocked state={access.state} />
    ) : (
      <NotAuthorized homeHref={access.homeHref} />
    );
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const since = cutoffFor(range) ?? undefined;

  // Total first, so we can clamp the page (a hand-typed `?page=999` shouldn't 404 or
  // show a blank — it should land on the last real page).
  const { total } = await getFeedbackStats(restaurant.id, since);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const rows = await getFeedbackPage(restaurant.id, {
    since,
    sort,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  /** Build a URL to this page with some params overridden (keeps the others). */
  const hrefWith = (over: { range?: Range; sort?: FeedbackSort; page?: number }) => {
    const q = new URLSearchParams();
    q.set("range", over.range ?? range);
    q.set("sort", over.sort ?? sort);
    q.set("page", String(over.page ?? page));
    return `/r/${slug}/orders?${q.toString()}`;
  };

  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              All orders
            </h1>
            <p className="text-sm text-[#6B7280]">
              {restaurant.name} — every submission, newest first.
            </p>
          </div>
          <Link
            href={`/r/${slug}/dashboard`}
            className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
          >
            ← Dashboard
          </Link>
        </header>

        {/* Controls: time range + sort. Changing either resets to page 1. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-[#F3F4F6] p-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={hrefWith({ range: r, page: 1 })}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                  r === range
                    ? "bg-white text-[#111827] shadow-sm"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {RANGE_LABELS[r]}
              </Link>
            ))}
          </div>

          <div className="inline-flex rounded-full bg-[#F3F4F6] p-1 text-sm">
            {SORTS.map((s) => (
              <Link
                key={s}
                href={hrefWith({ sort: s, page: 1 })}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                  s === sort
                    ? "bg-white text-[#111827] shadow-sm"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {SORT_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {total === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-[#6B7280]">
            No orders in this period. Try a different range, or submissions from the
            feedback form will show up here.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-[#9CA3AF]">
              Showing {firstOnPage}–{lastOnPage} of {total}
            </p>

            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <FeedbackItem key={r.id} record={r} />
              ))}
            </div>

            {/* Pager — only when there's more than one page. */}
            {pageCount > 1 && (
              <nav className="mt-6 flex items-center justify-between gap-3">
                {page > 1 ? (
                  <Link
                    href={hrefWith({ page: page - 1 })}
                    className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
                  >
                    ‹ Prev
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#F3F4F6] px-4 py-2 text-sm font-medium text-[#D1D5DB]">
                    ‹ Prev
                  </span>
                )}

                <span className="text-sm text-[#6B7280]">
                  Page {page} of {pageCount}
                </span>

                {page < pageCount ? (
                  <Link
                    href={hrefWith({ page: page + 1 })}
                    className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
                  >
                    Next ›
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#F3F4F6] px-4 py-2 text-sm font-medium text-[#D1D5DB]">
                    Next ›
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
