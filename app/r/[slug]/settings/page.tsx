/**
 * Owner settings page, served at `/r/[slug]/settings` (Milestone 18).
 *
 * SERVER component. PROTECTED by the same guard as the dashboard, so it inherits
 * the M16/M17 rules exactly: a branch manager gets their own branch, a brand owner
 * gets any branch of their brand, an operator gets nothing, and the guard re-reads
 * the database rather than trusting the session cookie.
 *
 * This is the page that means the operator no longer has to be phoned every time a
 * restaurant wants to change its Google link or its thresholds.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { getOwnerByEmail } from "@/lib/owners";
import { emailIsConfigured } from "@/lib/email";
import SettingsForm from "./SettingsForm";

// Always fresh — settings change and must show their new values immediately.
export const dynamic = "force-dynamic";

/** Shown when a signed-in user opens a restaurant that isn't theirs. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">
        These settings belong to a restaurant you don&apos;t manage.
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

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ── SECURITY GATE — runs before any of this restaurant's data is loaded ─────
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    notFound();
  }

  // The signed-in person's own notification preferences (they live on Owner, so
  // each manager controls their own inbox).
  const me = await getOwnerByEmail(access.ownerEmail);

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <header className="mb-6">
          <Link
            href={`/r/${slug}/dashboard`}
            className="text-sm font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
          >
            <span aria-hidden="true">‹</span> Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111827]">
            Settings
          </h1>
          <p className="text-sm text-[#6B7280]">
            {restaurant.name} — change these yourself, any time.
          </p>
        </header>

        <SettingsForm
          slug={slug}
          name={restaurant.name}
          googleReviewUrl={restaurant.googleReviewUrl ?? ""}
          reviewThreshold={restaurant.reviewThreshold}
          alertThreshold={restaurant.alertThreshold}
          alertsEnabled={me?.alertsEnabled ?? true}
          digestEnabled={me?.digestEnabled ?? false}
          isBrandOwner={!!me?.brandId}
          emailConfigured={emailIsConfigured()}
        />

        {/* The slug is NOT editable here, on purpose — see actions.ts. Say why,
            so the owner doesn't go hunting for it or ask the operator. */}
        <p className="mt-6 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#6B7280]">
          Your feedback link is{" "}
          <span className="font-mono text-[#111827]">/r/{slug}/feedback</span>. It
          can&apos;t be changed here because it&apos;s written onto the NFC chips on
          your tables — changing it would stop every chip working. Ask ScoreFlow if
          you really need it changed.
        </p>
      </div>
    </main>
  );
}
