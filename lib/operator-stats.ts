/**
 * The operator's SALES data (Milestone 21) — the numbers behind the business.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  THE BOUNDARY: this module returns COUNTS and MONEY. Never CONTENT.        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * The operator is the person selling ScoreFlow. They legitimately need to know who
 * signed up, who's paying, and whether a customer is actually USING the product
 * (a quiet account is about to churn). They do NOT get to read their customers'
 * feedback — no comments, no ratings, not even an average.
 *
 * That isn't just politeness, it's the product's best sales line: "even I can't
 * read your complaints." The guards already enforce it (an operator is refused on
 * every owner dashboard), and this file keeps the promise on the data side too —
 * note there is deliberately NO `_avg: { rating }` anywhere below, even though it
 * would be trivial to add.
 */

import { prisma } from "./prisma";
import { subscriptionState } from "./subscriptions";
import { APP_TIMEZONE, lastLocalDays, localDayKey } from "./time";
import { REVIEW_PLATFORMS, type ReviewPlatform } from "./review-platforms";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this a legacy/operator-made account (no trial clock, not paying) → comped.
 *
 * `canceled` is excluded deliberately: a comped account the operator has SUSPENDED
 * is not comped any more, it's cut off. Leaving it in this bucket would report a
 * suspended account as a happy freebie and hide it from the "lapsed" count — and it
 * has to agree with `subscriptionState`, which now locks it out (see that file).
 */
function isComped(b: { trialEndsAt: Date | null; subStatus: string }): boolean {
  return (
    b.trialEndsAt === null &&
    b.subStatus !== "active" &&
    b.subStatus !== "canceled"
  );
}

export interface SalesOverview {
  totalAccounts: number;
  trialing: number;
  active: number;
  lapsed: number;
  comped: number;
  /** Monthly recurring revenue: the sum of what ACTIVE accounts pay per month. */
  mrrPence: number;
  /** Actually collected in the last 30 days. */
  revenue30d: number;
  /** Actually collected, ever. */
  revenueTotal: number;
  /** New self-serve signups in the last 30 days. */
  signups30d: number;
  /** Of the customers who ever signed up, what share are paying? */
  conversionPct: number | null;
}

export async function getSalesOverview(): Promise<SalesOverview> {
  const since30 = new Date(Date.now() - 30 * DAY_MS);

  const [brands, revenue30, revenueAll] = await Promise.all([
    prisma.brand.findMany({
      select: {
        subStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        monthlyPricePence: true,
        createdAt: true,
      },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: since30 } },
      _sum: { amountPence: true },
    }),
    prisma.payment.aggregate({ _sum: { amountPence: true } }),
  ]);

  let trialing = 0;
  let active = 0;
  let lapsed = 0;
  let comped = 0;
  let mrrPence = 0;
  let signups30d = 0;

  for (const b of brands) {
    if (isComped(b)) {
      comped++;
      continue;
    }
    if (b.createdAt >= since30) signups30d++;

    const state = subscriptionState(b);
    if (!state.live) {
      lapsed++;
    } else if (state.kind === "active") {
      active++;
      mrrPence += b.monthlyPricePence;
    } else {
      trialing++;
    }
  }

  // "Of the real (paying-capable) customers, how many actually pay?"
  const sellable = trialing + active + lapsed;
  const conversionPct = sellable > 0 ? Math.round((active / sellable) * 100) : null;

  return {
    totalAccounts: brands.length,
    trialing,
    active,
    lapsed,
    comped,
    mrrPence,
    revenue30d: revenue30._sum.amountPence ?? 0,
    revenueTotal: revenueAll._sum.amountPence ?? 0,
    signups30d,
    conversionPct,
  };
}

/**
 * Which bucket an account falls in (Milestone 33) — the operator's Customers page
 * filters on this. Same classification the overview counts use (see `getSalesOverview`),
 * kept as one pure, testable function so the filter and the summary cards can never
 * disagree about who's "lapsed".
 */
export type AccountBucket = "trialing" | "active" | "lapsed" | "comped";

export function accountBucket(row: {
  isComped: boolean;
  live: boolean;
  subStatus: string;
}): AccountBucket {
  if (row.isComped) return "comped"; // operator-made freebie
  if (!row.live) return "lapsed"; // trial ran out, or suspended
  return row.subStatus === "active" ? "active" : "trialing";
}

export interface OperatorAccountRow {
  id: number;
  name: string;
  slug: string;
  ownerEmail: string;
  createdAt: string;
  locations: number;
  /** USAGE, not content: how many diners have submitted. Churn signal. */
  responses: number;
  /** When feedback last arrived. A quiet account is about to leave. */
  lastActivity: string | null;
  isComped: boolean;
  subStatus: string;
  live: boolean;
  trialDaysLeft: number | null;
  monthlyPricePence: number;
  totalPaid: number;
  currentPeriodEnd: string | null;
}

/**
 * Every account, with the numbers that tell you whether it's healthy and whether
 * it's paying. Two grouped queries rather than one-per-account.
 */
export async function getAccountsForOperator(): Promise<OperatorAccountRow[]> {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owners: { select: { email: true }, orderBy: { id: "asc" } },
      restaurants: { select: { id: true } },
    },
  });

  const restaurantIds = brands.flatMap((b) => b.restaurants.map((r) => r.id));

  // USAGE only: how many submissions, and when the last one landed.
  // Deliberately NO rating aggregate — see the boundary note at the top.
  const [usage, paid] = await Promise.all([
    restaurantIds.length
      ? prisma.feedback.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
    prisma.payment.groupBy({
      by: ["brandId"],
      _sum: { amountPence: true },
    }),
  ]);

  const usageByRestaurant = new Map(
    usage.map((u) => [u.restaurantId, { count: u._count._all, last: u._max.createdAt }])
  );
  const paidByBrand = new Map(paid.map((p) => [p.brandId, p._sum.amountPence ?? 0]));

  return brands.map((b) => {
    let responses = 0;
    let last: Date | null = null;
    for (const r of b.restaurants) {
      const u = usageByRestaurant.get(r.id);
      if (!u) continue;
      responses += u.count;
      if (u.last && (!last || u.last > last)) last = u.last;
    }

    const state = subscriptionState(b);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      ownerEmail: b.owners[0]?.email ?? "—",
      createdAt: b.createdAt.toISOString(),
      locations: b.restaurants.length,
      responses,
      lastActivity: last?.toISOString() ?? null,
      isComped: isComped(b),
      subStatus: b.subStatus,
      live: state.live,
      trialDaysLeft:
        state.live && state.kind === "trial" ? (state.trialDaysLeft ?? null) : null,
      monthlyPricePence: b.monthlyPricePence,
      totalPaid: paidByBrand.get(b.id) ?? 0,
      currentPeriodEnd: b.currentPeriodEnd?.toISOString() ?? null,
    };
  });
}

// ── Operator review-link oversight (Milestone 39) ───────────────────────────

export interface OperatorReviewLink {
  platform: ReviewPlatform;
  name: string;
  url: string;
  blocked: boolean;
}
export interface OperatorBranchLinks {
  restaurantId: number;
  branchName: string;
  slug: string;
  links: OperatorReviewLink[];
}
export interface BrandReviewLinks {
  brandId: number;
  brandName: string;
  brandSlug: string;
  branches: OperatorBranchLinks[];
}

/**
 * Every review link a brand's branches have set, with their operator-block status
 * (Milestone 39) — the data behind the operator's per-customer "Review links" view.
 *
 * ⚠️ Boundary check: review links are the restaurant's OWN PUBLIC page URLs (config),
 * NOT diner feedback — so surfacing them to the operator does not breach the "operator
 * never sees content" rule (a branch's URL is not a diner's comment). `null` if the
 * brand doesn't exist.
 */
export async function getBrandReviewLinks(
  brandId: number
): Promise<BrandReviewLinks | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      slug: true,
      restaurants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          googleReviewUrl: true,
          tripadvisorUrl: true,
          yelpUrl: true,
          zomatoUrl: true,
          blockedReviewPlatforms: true,
        },
      },
    },
  });
  if (!brand) return null;

  const branches: OperatorBranchLinks[] = brand.restaurants.map((r) => {
    const blocked = new Set(r.blockedReviewPlatforms);
    const links: OperatorReviewLink[] = [];
    for (const p of REVIEW_PLATFORMS) {
      const url = r[p.field];
      if (url && url.trim() !== "") {
        links.push({
          platform: p.id,
          name: p.name,
          url,
          blocked: blocked.has(p.id),
        });
      }
    }
    return { restaurantId: r.id, branchName: r.name, slug: r.slug, links };
  });

  return {
    brandId: brand.id,
    brandName: brand.name,
    brandSlug: brand.slug,
    branches,
  };
}

/**
 * Daily new-signup counts for the last `days` days — the growth bar chart.
 *
 * ⚠️ Bucketed by LOCAL (Europe/London) day via lib/time, NOT by `setHours()`.
 * `setHours(0,0,0,0)` means "midnight in the SERVER's timezone" — which on Vercel is
 * UTC, not London. Through British Summer Time that put every signup between
 * midnight and 1am BST into the previous day's bar, so the operator's growth chart
 * disagreed with every owner-facing chart (M24 fixed those and missed this one).
 * Same timezone everywhere, or two screens tell you two different stories.
 */
export async function getSignupTrend(
  days = 30
): Promise<{ label: string; count: number }[]> {
  const buckets = lastLocalDays(days);

  const brands = await prisma.brand.findMany({
    where: {
      createdAt: { gte: buckets[0].start },
      trialEndsAt: { not: null }, // real signups only
    },
    select: { createdAt: true },
  });

  // Count each signup into the local day it actually happened on.
  const byDay = new Map<string, number>();
  for (const b of brands) {
    const key = localDayKey(b.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
  });

  return buckets.map((d) => ({
    label: label.format(d.date),
    count: byDay.get(d.key) ?? 0,
  }));
}
