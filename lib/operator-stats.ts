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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Is this a legacy/operator-made account (no trial clock, not paying) → comped. */
function isComped(b: { trialEndsAt: Date | null; subStatus: string }): boolean {
  return b.trialEndsAt === null && b.subStatus !== "active";
}

export interface SalesOverview {
  totalAccounts: number;
  trialing: number;
  active: number;
  lapsed: number;
  comped: number;
  /** Monthly recurring revenue: the sum of what ACTIVE accounts pay per month. */
  mrrBdt: number;
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
        monthlyPrice: true,
        createdAt: true,
      },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: since30 } },
      _sum: { amountBdt: true },
    }),
    prisma.payment.aggregate({ _sum: { amountBdt: true } }),
  ]);

  let trialing = 0;
  let active = 0;
  let lapsed = 0;
  let comped = 0;
  let mrrBdt = 0;
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
      mrrBdt += b.monthlyPrice;
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
    mrrBdt,
    revenue30d: revenue30._sum.amountBdt ?? 0,
    revenueTotal: revenueAll._sum.amountBdt ?? 0,
    signups30d,
    conversionPct,
  };
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
  monthlyPrice: number;
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
      _sum: { amountBdt: true },
    }),
  ]);

  const usageByRestaurant = new Map(
    usage.map((u) => [u.restaurantId, { count: u._count._all, last: u._max.createdAt }])
  );
  const paidByBrand = new Map(paid.map((p) => [p.brandId, p._sum.amountBdt ?? 0]));

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
      monthlyPrice: b.monthlyPrice,
      totalPaid: paidByBrand.get(b.id) ?? 0,
      currentPeriodEnd: b.currentPeriodEnd?.toISOString() ?? null,
    };
  });
}

/** Daily new-signup counts for the last `days` days — the growth bar chart. */
export async function getSignupTrend(
  days = 30
): Promise<{ label: string; count: number }[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = new Date(start.getTime() - (days - 1) * DAY_MS);

  const brands = await prisma.brand.findMany({
    where: { createdAt: { gte: from }, trialEndsAt: { not: null } }, // real signups only
    select: { createdAt: true },
  });

  return Array.from({ length: days }, (_, i) => {
    const dayStart = from.getTime() + i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const count = brands.filter((b) => {
      const t = b.createdAt.getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    return {
      label: new Date(dayStart).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      count,
    };
  });
}
