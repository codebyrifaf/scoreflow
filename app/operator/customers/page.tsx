/**
 * The operator's Customers list — `/operator/customers` (Milestone 33).
 *
 * The full customer list used to sit inline on the operator dashboard, which got long
 * and unfilterable as accounts grew. It now lives here, behind the dashboard's
 * "Customers" button, with a status FILTER, a SORT, and PAGINATION — the same shape as
 * the owner's All-orders page.
 *
 * Same money-only boundary as the rest of the operator area: counts, revenue, and
 * usage (for churn), never a diner's feedback (see lib/operator-stats.ts).
 *
 * ── A note on the pagination ─────────────────────────────────────────────────
 * Unlike the owner's feedback (which grows without bound and needs DB-level paging),
 * this is the operator's OWN customer count — bounded by how many restaurants they've
 * sold to. So we load the full list (as the dashboard always did) and filter / sort /
 * page it in memory: real pagination for the UI, without a complex query. If the
 * operator ever has thousands of customers, revisit — but that's a good problem.
 */

import Link from "next/link";
import { requireOperator } from "@/lib/auth-guard";
import {
  getAccountsForOperator,
  accountBucket,
  type AccountBucket,
} from "@/lib/operator-stats";
import { logout } from "@/app/login/actions";
import OperatorAccounts from "../OperatorAccounts";

export const dynamic = "force-dynamic";

const PILL =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

const PAGE_SIZE = 20;

// ── Filter (by status) ────────────────────────────────────────────────────────
type Filter = "all" | AccountBucket;
const FILTERS: Filter[] = ["all", "trialing", "active", "lapsed", "comped"];
const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  trialing: "On trial",
  active: "Paying",
  lapsed: "Lapsed",
  comped: "Comped",
};
function parseFilter(raw: string | string[] | undefined): Filter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return FILTERS.includes(v as Filter) ? (v as Filter) : "all";
}

// ── Sort ──────────────────────────────────────────────────────────────────────
type Sort = "newest" | "oldest" | "revenue" | "quiet";
const SORTS: Sort[] = ["newest", "oldest", "revenue", "quiet"];
const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  revenue: "Most paid",
  quiet: "Least active",
};
function parseSort(raw: string | string[] | undefined): Sort {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SORTS.includes(v as Sort) ? (v as Sort) : "newest";
}

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

export default async function OperatorCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
}) {
  const access = await requireOperator();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  const sp = await searchParams;
  const filter = parseFilter(sp.status);
  const sort = parseSort(sp.sort);
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const requestedPage = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const all = await getAccountsForOperator();

  // Filter by status bucket.
  const filtered =
    filter === "all" ? all : all.filter((a) => accountBucket(a) === filter);

  // Sort.
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return ms(a.createdAt) - ms(b.createdAt);
      case "revenue":
        return b.totalPaid - a.totalPaid || ms(b.createdAt) - ms(a.createdAt);
      case "quiet":
        // Never-used (null) first, then longest-quiet → the churn-risk order.
        return ms(a.lastActivity) - ms(b.lastActivity);
      case "newest":
      default:
        return ms(b.createdAt) - ms(a.createdAt);
    }
  });

  // Paginate (clamp a hand-typed page).
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefWith = (over: { status?: Filter; sort?: Sort; page?: number }) => {
    const q = new URLSearchParams();
    q.set("status", over.status ?? filter);
    q.set("sort", over.sort ?? sort);
    q.set("page", String(over.page ?? page));
    return `/operator/customers?${q.toString()}`;
  };

  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="font-system min-h-dvh w-full bg-[#FAFAFA] text-[#111827]">
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              Operator
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Customers</h1>
          </div>
          <div className="flex flex-none items-center gap-3">
            <span className="hidden text-sm text-[#9CA3AF] sm:inline">
              {access.operatorEmail}
            </span>
            <Link href="/operator" className={PILL}>
              ← Dashboard
            </Link>
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

        {/* Controls: status filter + sort. Changing either resets to page 1. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-full bg-[#F3F4F6] p-1 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={hrefWith({ status: f, page: 1 })}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                  f === filter
                    ? "bg-white text-[#111827] shadow-sm"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {FILTER_LABELS[f]}
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
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
            No {filter === "all" ? "" : FILTER_LABELS[filter].toLowerCase() + " "}
            customers{filter === "all" ? " yet" : ""}. When a restaurant signs up at{" "}
            <span className="font-mono">/signup</span>, they&apos;ll appear here.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-[#9CA3AF]">
              Showing {firstOnPage}–{lastOnPage} of {total}
            </p>

            <OperatorAccounts accounts={pageRows} />

            {pageCount > 1 && (
              <nav className="mt-6 flex items-center justify-between gap-3">
                {page > 1 ? (
                  <Link href={hrefWith({ page: page - 1 })} className={PILL}>
                    ‹ Prev
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#F3F4F6] px-3 py-1.5 text-sm font-medium text-[#D1D5DB]">
                    ‹ Prev
                  </span>
                )}
                <span className="text-sm text-[#6B7280]">
                  Page {page} of {pageCount}
                </span>
                {page < pageCount ? (
                  <Link href={hrefWith({ page: page + 1 })} className={PILL}>
                    Next ›
                  </Link>
                ) : (
                  <span className="rounded-full border border-[#F3F4F6] px-3 py-1.5 text-sm font-medium text-[#D1D5DB]">
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
