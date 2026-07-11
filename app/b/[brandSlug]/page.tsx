/**
 * Brand owner console, served at `/b/[brandSlug]` (Milestone 16).
 *
 * SERVER component, PROTECTED by `requireBrandAccess` — only the brand's own
 * brand-owner. Shows brand-wide stats and a comparison card per branch, so the
 * owner can see "Gulshan 6.2 vs Uttara 8.9" at a glance and drill into any branch.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrandAccess } from "@/lib/auth-guard";
import { getBrandBySlug, getBrandStats, getBranchesForBrand } from "@/lib/brands";
import { logout } from "@/app/login/actions";
import ChangePassword from "@/app/r/[slug]/dashboard/ChangePassword";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import BrandBranches from "./BrandBranches";

export const dynamic = "force-dynamic";

const CARD = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const PILL =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

/** Shown when a signed-in NON-brand-owner opens a brand console. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">
        This brand console isn&apos;t one you can view.
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD}>
      <div className="text-sm text-[#6B7280]">{label}</div>
      <div className="mt-1 text-3xl font-bold text-[#111827]">{value}</div>
    </div>
  );
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;

  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) {
    return access.reason === "subscription" ? (
      <SubscriptionLocked state={access.state} />
    ) : (
      <NotAuthorized homeHref={access.homeHref} />
    );
  }

  const brand = await getBrandBySlug(brandSlug);
  if (!brand) {
    notFound();
  }

  const [stats, branches] = await Promise.all([
    getBrandStats(brand.id),
    getBranchesForBrand(brand.id),
  ]);

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {brand.name}
            </h1>
            <p className="text-sm text-[#6B7280]">Brand overview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChangePassword />
            <span className="text-sm text-[#9CA3AF]">{access.ownerEmail}</span>
            <form action={logout}>
              <button type="submit" className={PILL}>
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Brand-wide overview */}
        <section className="mb-8 grid grid-cols-3 gap-3">
          <StatCard label="Branches" value={stats.branchCount} />
          <StatCard label="Responses" value={stats.responseCount} />
          <StatCard
            label="Avg rating"
            value={stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
          />
        </section>

        {/* Branch comparison cards + add/edit/delete/reset */}
        <BrandBranches brandSlug={brandSlug} branches={branches} />
      </div>
    </main>
  );
}
