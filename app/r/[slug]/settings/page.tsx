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
import { squareSettingsFor } from "@/lib/square";
import { appUrl } from "@/lib/app-url";
import { formatInAppTz } from "@/lib/time";
import SubscriptionLocked from "@/app/SubscriptionLocked";
import SettingsForm from "./SettingsForm";
import LogoUploader from "./LogoUploader";
import MenuManager, { DishSuggestions, PosConnection } from "./MenuManager";
import SettingsShell, { SettingsPanel } from "./SettingsShell";
import { isSectionId, type SectionId } from "./sections";

// Always fresh — settings change and must show their new values immediately.
export const dynamic = "force-dynamic";

/** Shown when a signed-in user opens a restaurant that isn't theirs. */
function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#0F172A]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
        ⛔
      </div>
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#64748B]">
        These settings belong to a restaurant you don&apos;t manage.
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

/** The outcomes /api/square/oauth/callback can send back. Anything else is ignored,
 *  so a hand-edited URL can't put arbitrary text on the page. */
const SQUARE_NOTICES = ["connected", "denied", "in-use", "forbidden", "not-configured", "error"];

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { square: squareParam, section: sectionParam } = await searchParams;
  const squareNotice =
    typeof squareParam === "string" && SQUARE_NOTICES.includes(squareParam) ? squareParam : null;

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
  const [menu, lastOrder, square] = await Promise.all([
    isAccountOwner && me?.brandId ? getMenu(me.brandId) : Promise.resolve([]),
    isAccountOwner ? lastOrderReceivedAt(restaurant.id) : Promise.resolve(null),
    // Square is account-level too. This asks Square for the business's locations,
    // so it's only done for the one person who can act on them.
    isAccountOwner && me?.brandId
      ? squareSettingsFor(me.brandId, restaurant.id)
      : Promise.resolve(null),
  ]);

  // ── Which sections this person gets (the ☰ menu), in menu order ────────────
  // A branch manager gets their own restaurant's four. The ACCOUNT OWNER also gets
  // the account-wide ones — logo, menu, suggestions, till, close account — exactly
  // who could see (and save) them before; every server action re-checks this.
  const hasMenu = isAccountOwner && !!square;
  const sections: SectionId[] = [
    "restaurant",
    "reviews",
    "ratings",
    "notifications",
    ...(isAccountOwner ? (["logo"] as const) : []),
    ...(hasMenu ? (["menu", "suggestions", "till"] as const) : []),
    ...(isAccountOwner ? (["account"] as const) : []),
  ];
  // Open first: `?section=` (a refresh, or a dashboard link) if this person has it;
  // straight back from Square → the till section, where the outcome is shown;
  // otherwise the top of the list.
  const initialSection: SectionId =
    isSectionId(sectionParam) && sections.includes(sectionParam)
      ? sectionParam
      : squareNotice && sections.includes("till")
        ? "till"
        : "restaurant";

  const dishes = menu.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    positiveChips: d.positiveChips,
    negativeChips: d.negativeChips,
    chipsSource: d.chipsSource,
  }));

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#0F172A]">
      {/* Phone/tablet: one comfortable column. Laptop: wider, to fit the menu on
          the left. */}
      <div className="mx-auto w-full max-w-2xl px-5 py-8 lg:max-w-5xl">
        <header className="mb-6">
          <Link
            href={`/r/${slug}/dashboard`}
            className="text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
          >
            <span aria-hidden="true">‹</span> Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">
            Settings
          </h1>
          <p className="break-words text-sm text-[#64748B]">
            {restaurant.name} — change these yourself, any time.
          </p>
        </header>

        <SettingsShell sections={sections} initial={initialSection}>
          {/* Restaurant, Review links, Ratings, Notifications — one form, one Save. */}
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
            <SettingsPanel id="logo">
              <LogoUploader
                slug={slug}
                currentLogo={me.brand?.logoDataUrl ?? null}
                fallbackInitial={restaurant.name.charAt(0).toUpperCase()}
              />
            </SettingsPanel>
          )}

          {/* Menu, suggestions, till — ACCOUNT OWNER only. The menu is shared by every
              location (like the logo, M26), so a single branch manager doesn't own
              that call. Every server action re-checks this. */}
          {hasMenu && square && (
            <>
              <SettingsPanel id="menu">
                <MenuManager
                  slug={slug}
                  dishes={dishes}
                  aiConfigured={aiIsConfigured()}
                  square={square}
                />
              </SettingsPanel>
              <SettingsPanel id="suggestions">
                <DishSuggestions slug={slug} dishes={dishes} />
              </SettingsPanel>
              <SettingsPanel id="till">
                <PosConnection
                  slug={slug}
                  connected={!!restaurant.posKeyHash}
                  keyPrefix={restaurant.posKeyPrefix}
                  lastOrderAt={lastOrder ? formatInAppTz(lastOrder.toISOString()) : null}
                  posUrl={`${appUrl()}/api/pos/orders`}
                  square={square}
                  squareNotice={squareNotice}
                />
              </SettingsPanel>
            </>
          )}

          {/* Danger zone — ACCOUNT OWNER only. A branch manager must never be able to
              delete their employer's whole company (M22). */}
          {me?.brandId && (
            <SettingsPanel id="account">
              <section className="rounded-2xl border border-red-200 p-5">
                <h2 className="text-lg font-semibold text-[#0F172A]">Close account</h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Permanently delete this account, every location, and all of your
                  diner feedback. This can&apos;t be undone.
                </p>
                <Link
                  href="/account/close"
                  className="mt-4 inline-block rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Close my account
                </Link>
              </section>
            </SettingsPanel>
          )}
        </SettingsShell>
      </div>
    </main>
  );
}
