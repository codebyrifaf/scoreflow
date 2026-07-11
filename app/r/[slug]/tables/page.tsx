/**
 * Owner Tables & NFC links page, served at `/r/[slug]/tables` (Milestone 8).
 *
 * A SERVER component, PROTECTED exactly like the dashboard: the owner manages the
 * list of tables here and copies each table's NFC link onto its chip.
 *   • Not logged in            → requireDashboardAccess redirects to /login.
 *   • Logged in, wrong owner    → "Not authorized" (no data loaded).
 *   • The restaurant's owner    → the tables manager renders.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { getTablesForRestaurant } from "@/lib/tables";
import TablesManager from "./TablesManager";

export const dynamic = "force-dynamic";

/** Same clean 403 screen the dashboard uses when the wrong owner visits. */
function NotAuthorized({ ownSlug }: { ownSlug: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold text-[#111827]">Not authorized</h1>
      <p className="text-[#6B7280]">
        You&apos;re signed in, but these tables belong to a different restaurant.
      </p>
      <Link
        href={`/r/${ownSlug}/dashboard`}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
      >
        Go to my dashboard
      </Link>
    </main>
  );
}

export default async function TablesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Same security gate as the dashboard — runs before any data loads.
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return <NotAuthorized ownSlug={access.ownerRestaurantSlug} />;
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    notFound();
  }

  const tables = await getTablesForRestaurant(restaurant.id);

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {restaurant.name} — Tables &amp; NFC links
            </h1>
            <p className="text-sm text-[#6B7280]">
              Add a table, then copy its link onto that table&apos;s NFC chip.
            </p>
          </div>
          <Link
            href={`/r/${slug}/dashboard`}
            className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
          >
            ← Back to dashboard
          </Link>
        </header>

        {/* How-to hint */}
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Write each link onto that table&apos;s NFC chip (using a free app like
          &ldquo;NFC Tools&rdquo;). When a customer taps the chip, the feedback
          form opens for that exact table.{" "}
          <span className="text-amber-700">
            Note: these links use this site&apos;s current address, so they work
            fully once ScoreFlow is deployed to a real domain.
          </span>
        </div>

        <TablesManager
          slug={slug}
          tables={tables.map((t) => ({ id: t.id, label: t.label }))}
        />
      </div>
    </main>
  );
}
