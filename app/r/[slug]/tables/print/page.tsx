/**
 * The printable QR "starter kit" — `/r/[slug]/tables/print` (Milestone 30).
 *
 * THE feature that removes ScoreFlow's biggest setup barrier. Instead of buying and
 * programming NFC chips, an owner opens this page, hits Print / Save as PDF, and gets a
 * sheet of cut-out cards — one per table plus a "counter" card — each with a QR code
 * that opens that table's feedback form. Print, cut, place on tables, live in minutes.
 *
 * SECURITY: guarded by `requireDashboardAccess(slug)`, exactly like the tables page it
 * links from — owner-only, and the subscription-locked screen for a lapsed trial (they
 * can't manage tables then either, so the kit locking too is consistent). The QR codes
 * themselves only ever encode the PUBLIC feedback URL, so scanning keeps working even
 * when the owner's trial has lapsed — the same "diners are never punished" rule as NFC.
 *
 * PRINTING: no PDF library. It's a print-optimised web page; the browser's own dialog
 * (via <PrintButton>) does the rest. QR codes are inline SVG (see app/QrCode.tsx), so
 * nothing is fetched — fully inside the M25 CSP.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantForFeedback } from "@/lib/restaurants";
import { getTablesForRestaurant } from "@/lib/tables";
import { feedbackUrl } from "@/lib/app-url";
import { qrMatrix } from "@/lib/qr";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import QrCode from "@/app/QrCode";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

/** Same clean 403 the dashboard/tables pages use. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold text-[#111827]">Not authorized</h1>
      <p className="text-[#6B7280]">
        You&apos;re signed in, but this kit isn&apos;t one you can print.
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

/** One printable, cut-out card: branding, a QR, and its table label. */
function KitCard({
  matrix,
  name,
  logoUrl,
  tableLabel,
}: {
  matrix: ReturnType<typeof qrMatrix>;
  name: string;
  logoUrl: string | null;
  /** The table's name, or null for the general "counter" card. */
  tableLabel: string | null;
}) {
  return (
    <div className="qr-card flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#C7C7CC] p-6 text-center">
      {/* Brand: the logo (M26) if the owner set one, otherwise the name in text. */}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL, not remote
        <img
          src={logoUrl}
          alt={name}
          className="h-12 w-12 rounded-xl border border-[#E5E7EB] object-contain p-1"
        />
      ) : (
        <div className="text-lg font-bold tracking-tight text-[#111827]">
          {name}
        </div>
      )}

      <p className="text-sm font-semibold text-[#111827]">Scan to rate your meal</p>

      {/* The code. Fixed physical box so every card prints the same size. */}
      <QrCode
        matrix={matrix}
        title={tableLabel ? `Feedback QR for table ${tableLabel}` : "Feedback QR"}
        className="h-44 w-44"
      />

      <div>
        {tableLabel ? (
          <p className="text-base font-bold text-[#111827]">Table {tableLabel}</p>
        ) : (
          <p className="text-base font-bold text-[#111827]">Order at the counter</p>
        )}
        <p className="mt-0.5 text-xs text-[#6B7280]">
          Takes 10 seconds · no app needed
        </p>
      </div>
    </div>
  );
}

export default async function PrintKitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return access.reason === "subscription" ? (
      <SubscriptionLocked state={access.state} />
    ) : (
      <NotAuthorized homeHref={access.homeHref} />
    );
  }

  // One query gets the restaurant + its brand logo (M26).
  const restaurant = await getRestaurantForFeedback(slug);
  if (!restaurant) notFound();

  const tables = await getTablesForRestaurant(restaurant.id);
  const logoUrl = restaurant.brand?.logoDataUrl ?? null;

  // Pre-compute every QR server-side (the encoder never touches the client).
  const generalCard = {
    tableLabel: null as string | null,
    matrix: qrMatrix(feedbackUrl(slug)),
  };
  const tableCards = tables.map((t) => ({
    tableLabel: t.label,
    matrix: qrMatrix(feedbackUrl(slug, t.label)),
  }));

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      {/* Toolbar — hidden when printing. */}
      <div className="print:hidden border-b border-[#E5E7EB]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#111827]">
              {restaurant.name} — QR kit
            </h1>
            <p className="text-sm text-[#6B7280]">
              Print this, cut out the cards, and stand one on each table. No chips, no
              app.
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Link
              href={`/r/${slug}/tables`}
              className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
            >
              ← Tables
            </Link>
            <PrintButton className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600" />
          </div>
        </div>
      </div>

      {/* The kit itself. `qr-sheet` gets the print sizing from globals.css. */}
      <div className="qr-sheet mx-auto max-w-4xl px-5 py-8">
        {tables.length === 0 && (
          <div className="print:hidden mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You haven&apos;t added any tables yet, so this kit only has a general
            &ldquo;counter&rdquo; card.{" "}
            <Link href={`/r/${slug}/tables`} className="font-semibold underline">
              Add your tables
            </Link>{" "}
            to get one card per table.
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {tableCards.map((card) => (
            <KitCard
              key={card.tableLabel}
              matrix={card.matrix}
              name={restaurant.name}
              logoUrl={logoUrl}
              tableLabel={card.tableLabel}
            />
          ))}
          {/* The general / counter card always prints, so a takeaway or a poster is
              covered even with zero tables. */}
          <KitCard
            matrix={generalCard.matrix}
            name={restaurant.name}
            logoUrl={logoUrl}
            tableLabel={null}
          />
        </div>
      </div>
    </main>
  );
}
