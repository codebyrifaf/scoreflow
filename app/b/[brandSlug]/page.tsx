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

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white p-5";
const PILL =
  "rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]";

/** Shown when a signed-in NON-brand-owner opens a brand console. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#0F172A]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#64748B]">
        This brand console isn&apos;t one you can view.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-deep"
      >
        Go back
      </Link>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD}>
      <div className="text-sm text-[#64748B]">{label}</div>
      <div className="mt-1 text-3xl font-bold text-[#0F172A]">{value}</div>
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
    <main className="font-system min-h-dvh w-full bg-white text-[#0F172A]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {brand.name}
            </h1>
            <p className="text-sm text-[#64748B]">
              {/* A brand-new account has no locations yet — signup creates the account
                  and stops. Calling that an "overview" over three zeroes would be an
                  odd first impression. */}
              {branches.length === 0 ? "Your account" : "Account overview"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChangePassword />
            <span className="text-sm text-[#94A3B8]">{access.ownerEmail}</span>
            <form action={logout}>
              <button type="submit" className={PILL}>
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Account-wide overview.
            HIDDEN until there's at least one location: a customer who has just
            finished signing up would otherwise be met by "Branches 0 / Responses 0 /
            Avg —", three pieces of nothing sitting above the one thing they actually
            need to do. BrandBranches renders the "add your first location" onboarding
            in that case. */}
        {branches.length > 0 && (
          <section className="mb-8 grid grid-cols-3 gap-3">
            <StatCard label="Locations" value={stats.branchCount} />
            <StatCard label="Responses" value={stats.responseCount} />
            <StatCard
              label="Avg rating"
              value={stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
            />
          </section>
        )}

        {/* Branch comparison cards + add/edit/delete/reset */}
        <BrandBranches brandSlug={brandSlug} branches={branches} />
      </div>
    </main>
  );
}
