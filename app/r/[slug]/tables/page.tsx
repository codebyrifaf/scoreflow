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
import { feedbackUrl } from "@/lib/app-url";
import { qrMatrix } from "@/lib/qr";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import TablesManager from "./TablesManager";

export const dynamic = "force-dynamic";

/** Same clean 403 screen the dashboard uses when access is denied. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold text-[#111827]">Not authorized</h1>
      <p className="text-[#6B7280]">
        You&apos;re signed in, but these tables aren&apos;t ones you can manage.
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

export default async function TablesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Same security gate as the dashboard — runs before any data loads.
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

  const tables = await getTablesForRestaurant(restaurant.id);

  // A QR matrix per table (M30), generated server-side and passed down. The encoder
  // never reaches the client — TablesManager renders these with the pure <QrCode>.
  const tablesWithQr = tables.map((t) => ({
    id: t.id,
    label: t.label,
    qr: qrMatrix(feedbackUrl(slug, t.label)),
  }));

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {restaurant.name} — Tables &amp; links
            </h1>
            <p className="text-sm text-[#6B7280]">
              Add a table, then put its QR code or NFC link on that table.
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            {/* The QR kit — the zero-hardware way to go live (M30). */}
            <Link
              href={`/r/${slug}/tables/print`}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
            >
              Print QR kit →
            </Link>
            <Link
              href={`/r/${slug}/dashboard`}
              className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        {/* How-to hint — QR first (no hardware), NFC as the premium option. */}
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>Two ways to go live, your choice.</b> The quickest:{" "}
          <Link href={`/r/${slug}/tables/print`} className="font-semibold underline">
            print the QR kit
          </Link>{" "}
          and put a card on each table — no hardware. Or, for a tap-to-rate NFC chip,
          copy a table&apos;s link onto it with a free app like &ldquo;NFC Tools&rdquo;.
          Either way, opening it shows the feedback form for that exact table.
        </div>

        <TablesManager slug={slug} tables={tablesWithQr} />
      </div>
    </main>
  );
}
