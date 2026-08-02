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
import { aiIsConfigured } from "@/lib/ai";
import { getMenu } from "@/lib/menu";
import { lastOrderReceivedAt } from "@/lib/pos-orders";
import { appUrl } from "@/lib/app-url";
import { formatInAppTz } from "@/lib/time";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import SettingsForm from "./SettingsForm";
import LogoUploader from "./LogoUploader";
import MenuManager from "./MenuManager";

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

  // The signed-in person's own notification preferences (they live on Owner, so
  // each manager controls their own inbox).
  const me = await getOwnerByEmail(access.ownerEmail);

  // The MENU and the POS connection. Both are ACCOUNT-level, so they're only
  // loaded — and only rendered — for the account owner, exactly like the logo.
  const isAccountOwner = !!me?.brandId;
  const [menu, lastOrder] = await Promise.all([
    isAccountOwner && me?.brandId ? getMenu(me.brandId) : Promise.resolve([]),
    isAccountOwner ? lastOrderReceivedAt(restaurant.id) : Promise.resolve(null),
  ]);

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
          tripadvisorUrl={restaurant.tripadvisorUrl ?? ""}
          yelpUrl={restaurant.yelpUrl ?? ""}
          zomatoUrl={restaurant.zomatoUrl ?? ""}
          blockedPlatforms={restaurant.blockedReviewPlatforms}
          positiveThreshold={restaurant.positiveThreshold}
          alertThreshold={restaurant.alertThreshold}
          alertsEnabled={me?.alertsEnabled ?? true}
          digestEnabled={me?.digestEnabled ?? false}
          isBrandOwner={!!me?.brandId}
          emailConfigured={emailIsConfigured()}
        />

        {/* Logo — ACCOUNT OWNER only. It's a BRAND-WIDE look that shows on every
            branch's feedback page, so a single branch manager doesn't own that call
            (M26). The save action re-checks this server-side. */}
        {me?.brandId && (
          <div className="mt-6">
            <LogoUploader
              slug={slug}
              currentLogo={me.brand?.logoDataUrl ?? null}
              fallbackInitial={restaurant.name.charAt(0).toUpperCase()}
            />
          </div>
        )}

        {/* Menu + till connection — ACCOUNT OWNER only. The menu is shared by every
            location (like the logo, M26), so a single branch manager doesn't own
            that call. Both server actions re-check this. */}
        {isAccountOwner && (
          <div className="mt-6">
            <MenuManager
              slug={slug}
              dishes={menu.map((d) => ({
                id: d.id,
                name: d.name,
                category: d.category,
                positiveChips: d.positiveChips,
                negativeChips: d.negativeChips,
                chipsSource: d.chipsSource,
              }))}
              aiConfigured={aiIsConfigured()}
              posConnected={!!restaurant.posKeyHash}
              posKeyPrefix={restaurant.posKeyPrefix}
              lastOrderAt={lastOrder ? formatInAppTz(lastOrder.toISOString()) : null}
              posUrl={`${appUrl()}/api/pos/orders`}
            />
          </div>
        )}

        {/* The slug is NOT editable here, on purpose — see actions.ts. Say why,
            so the owner doesn't go hunting for it. */}
        <p className="mt-6 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#6B7280]">
          Your feedback link is{" "}
          <span className="font-mono text-[#111827]">/r/{slug}/feedback</span>. It
          can&apos;t be changed, because it&apos;s written onto the NFC chips on your
          tables — changing it would stop every chip working.
        </p>

        {/* Danger zone — ACCOUNT OWNER only. A branch manager must never be able to
            delete their employer's whole company (M22). */}
        {me?.brandId && (
          <section className="mt-8 rounded-2xl border border-red-200 p-5">
            <h2 className="text-lg font-semibold text-[#111827]">Close account</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Permanently delete this account, every location, and all of your diner
              feedback. This can&apos;t be undone.
            </p>
            <Link
              href="/account/close"
              className="mt-4 inline-block rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Close my account
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
