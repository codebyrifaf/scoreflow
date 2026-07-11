/**
 * Operator admin dashboard, served at `/admin` (Milestone 6; redesigned in M10).
 *
 * SERVER component. The operator-only area to view every restaurant and add new
 * ones. PROTECTED the same way as the owner dashboard — the check runs here,
 * before any data loads.
 *   • Not logged in        → requireOperator redirects to /login.
 *   • Logged in, not operator (e.g. an owner) → "Not authorized".
 *   • Logged in as operator → the dashboard renders.
 *
 * M10 redesign: premium white theme, a platform-overview stat row, and the
 * restaurant list as cards with an "Add restaurant" modal (see AdminRestaurants).
 */

import Link from "next/link";
import { requireOperator } from "@/lib/auth-guard";
import { getAllRestaurantsForAdmin, getPlatformStats } from "@/lib/restaurants";
import { getAllBrandsForAdmin } from "@/lib/brands";
import { logout } from "@/app/login/actions";
import AdminRestaurants from "./AdminRestaurants";
import AdminBrands from "./AdminBrands";

// Always render fresh so a newly added restaurant shows up right away.
export const dynamic = "force-dynamic";

const CARD_CLASS = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const PILL_BTN_CLASS =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

/** Shown when a signed-in NON-operator (e.g. an owner) opens /admin. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">The admin area is for ScoreFlow operators only.</p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
      >
        Go back
      </Link>
    </main>
  );
}

/** One small platform-overview stat. */
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD_CLASS}>
      <div className="text-sm text-[#6B7280]">{label}</div>
      <div className="mt-1 text-3xl font-bold text-[#111827]">{value}</div>
    </div>
  );
}

export default async function AdminPage() {
  // ── SECURITY GATE ───────────────────────────────────────────────────────────
  const access = await requireOperator();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  const [restaurants, brands, stats] = await Promise.all([
    getAllRestaurantsForAdmin(),
    getAllBrandsForAdmin(),
    getPlatformStats(),
  ]);

  const brandCards = brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    branchCount: b.restaurants.length,
    branchNames: b.restaurants.map((r) => r.name),
    responses: b.restaurants.reduce((sum, r) => sum + r._count.feedback, 0),
    tables: b.restaurants.reduce((sum, r) => sum + r._count.tables, 0),
    ownerEmails: b.owners.map((o) => o.email),
  }));

  const cards = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    googleReviewUrl: r.googleReviewUrl ?? "",
    ownerEmails: r.owners.map((o) => o.email),
    responses: r._count.feedback,
    tables: r._count.tables,
    reviewThreshold: r.reviewThreshold,
  }));

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Restaurants
            </h1>
            <p className="text-sm text-[#6B7280]">
              Manage the restaurants on ScoreFlow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#9CA3AF]">{access.operatorEmail}</span>
            <form action={logout}>
              <button type="submit" className={PILL_BTN_CLASS}>
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Platform overview */}
        <section className="mb-8 grid grid-cols-3 gap-3">
          <StatCard label="Restaurants" value={stats.restaurantCount} />
          <StatCard label="Responses" value={stats.responseCount} />
          <StatCard
            label="Avg rating"
            value={stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
          />
        </section>

        {/* Brands (chains) — each groups several branch restaurants */}
        <AdminBrands brands={brandCards} />

        {/* Restaurant cards + add-restaurant modal */}
        <AdminRestaurants restaurants={cards} />
      </div>
    </main>
  );
}
