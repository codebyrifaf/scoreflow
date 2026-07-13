"use server";

/**
 * Owner self-service settings (Milestone 18).
 *
 * THIS IS THE FILE THAT STOPS THE OPERATOR BEING A BOTTLENECK. Until now a
 * restaurant owner could not change a single thing about their own venue — not
 * their name, not their Google review link, not the rating that earns a Google
 * invite (which the landing page openly advertises). Every one of those was a
 * phone call to the operator. At 25 restaurants that's a full-time support job and
 * he can't sell any more.
 *
 * SECURITY — the same two rules as everywhere else in this codebase:
 *   1. `requireDashboardAccess(slug)` decides IF you may touch this restaurant. It
 *      already encodes the M16/M17 rules (a branch manager gets their own branch; a
 *      brand owner gets any branch of their brand; everyone else is out), and it
 *      re-reads the database rather than trusting the session — so we inherit all
 *      of that for free.
 *   2. The restaurant is resolved from the URL SLUG on the server. The form never
 *      sends an id, so it can't ask us to edit somebody else's restaurant.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug, updateRestaurantSettings } from "@/lib/restaurants";
import { updateNotificationPrefs } from "@/lib/owners";
import { updateBrandLogo } from "@/lib/brands";
import { isValidReviewUrl, reviewUrlError } from "@/lib/review-url";
import { REVIEW_PLATFORMS } from "@/lib/review-platforms";

export type SettingsState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;

/**
 * Save a restaurant's settings. Bound in the client as
 * `saveSettings.bind(null, slug)`.
 *
 * ⚠️ The SLUG IS NOT EDITABLE HERE, and that's deliberate. NFC chips are physically
 * programmed with `/r/<slug>/feedback` and stuck to the tables. If an owner renamed
 * their slug, every chip in the restaurant would silently stop working and they'd
 * have no idea why the feedback dried up. Slug changes stay with the operator, who
 * knows to re-program the chips. `updateRestaurantSettings` cannot write the slug
 * even if someone forged a `slug` field into this form post.
 */
export async function saveSettings(
  slug: string,
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return { errors: { form: "You are not authorized to change these settings." } };
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return { errors: { form: "Restaurant not found." } };
  }

  const name = String(formData.get("name") ?? "").trim();
  const positiveThresholdRaw = String(formData.get("positiveThreshold") ?? "").trim();
  const alertThresholdRaw = String(formData.get("alertThreshold") ?? "").trim();

  const errors: Record<string, string> = {};

  if (!name) errors.name = "Restaurant name is required.";

  // ── The four review links (M29) ───────────────────────────────────────────
  // Each is OPTIONAL (blank = no tile for that platform) and each is validated
  // against ITS OWN platform's host allowlist — a Yelp URL pasted into the
  // Tripadvisor box is rejected, not silently accepted.
  //
  // ⚠️ This is the check that keeps /r/<slug>/go-review from becoming an OPEN
  // REDIRECT on our own domain: that route forwards a diner to whatever is stored
  // here, so "any https URL" would let an owner launder a phishing link through our
  // credibility (the M25 finding). Four platforms = four chances to reopen that hole.
  // The redirect re-checks these too, but this is the front door.
  const reviewUrls: Record<string, string | null> = {};
  for (const platform of REVIEW_PLATFORMS) {
    const raw = String(formData.get(platform.field) ?? "").trim();
    if (raw && !isValidReviewUrl(platform.id, raw)) {
      errors[platform.field] = reviewUrlError(platform.id);
    }
    reviewUrls[platform.field] = raw || null; // blank clears the link
  }

  const positiveThreshold = Number(positiveThresholdRaw);
  if (
    !Number.isInteger(positiveThreshold) ||
    positiveThreshold < 1 ||
    positiveThreshold > 10
  ) {
    errors.positiveThreshold = "Pick a whole number from 1 to 10.";
  }

  const alertThreshold = Number(alertThresholdRaw);
  if (
    !Number.isInteger(alertThreshold) ||
    alertThreshold < 1 ||
    alertThreshold > 10
  ) {
    errors.alertThreshold = "Pick a whole number from 1 to 10.";
  }

  // The two thresholds must not overlap, or the rules contradict each other: a
  // diner would be told "thanks, please review us on Google" AND be logged as a
  // complaint that wakes the manager up. The alert level must sit strictly below
  // the Google level.
  if (!errors.positiveThreshold && !errors.alertThreshold) {
    if (alertThreshold >= positiveThreshold) {
      errors.alertThreshold = `Must be lower than the Google review score (${positiveThreshold}) — otherwise a diner could be asked for a public review and be logged as a complaint at the same time.`;
    }
  }

  // ── The signed-in person's own notification preferences ───────────────────
  // These live on the Owner row, not the Restaurant, so each manager controls
  // their own inbox. We take the account id from the SESSION — never from the
  // form — so nobody can change someone else's notification settings.
  const session = await auth();
  const accountId = session?.user?.accountId;
  const isOwnerAccount = session?.user?.kind === "owner";

  const alertsEnabled = formData.get("alertsEnabled") === "on";
  const digestEnabled = formData.get("digestEnabled") === "on";

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await updateRestaurantSettings(restaurant.id, {
      name,
      googleReviewUrl: reviewUrls.googleReviewUrl,
      tripadvisorUrl: reviewUrls.tripadvisorUrl,
      yelpUrl: reviewUrls.yelpUrl,
      zomatoUrl: reviewUrls.zomatoUrl,
      positiveThreshold,
      alertThreshold,
    });

    if (accountId && isOwnerAccount) {
      await updateNotificationPrefs(accountId, { alertsEnabled, digestEnabled });
    }
  } catch {
    return { errors: { form: "Could not save your settings. Please try again." } };
  }

  // The dashboard shows the name and the "no Google link" warning; the feedback
  // page uses the thresholds. Refresh both.
  revalidatePath(`/r/${slug}/dashboard`);
  revalidatePath(`/r/${slug}/settings`);
  revalidatePath(`/r/${slug}/feedback`);

  return { ok: true };
}

// ── Brand logo (Milestone 26) ───────────────────────────────────────────────

/** Max length of the stored data URL. The browser resizes to ~256px first, so a
 *  real logo is ~10–40 KB; this generous cap just bounds abuse + DB bloat. */
const MAX_LOGO_CHARS = 300 * 1024; // ~300 KB

/**
 * Validate a client-supplied logo data URL. Returns an error message or null.
 *
 * ⚠️ This is a security boundary: the data URL comes from the browser and is later
 * rendered in an `<img src>`. We accept ONLY base64 PNG/JPEG/WebP — never SVG
 * (which can carry script) and never `data:text/html` — and we cap the size. The
 * strict regex also guarantees it's genuinely base64, so nothing odd rides along.
 */
function validateLogoDataUrl(dataUrl: string): string | null {
  if (dataUrl.length > MAX_LOGO_CHARS) {
    return "That image is too large — please use a smaller logo.";
  }
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) {
    return "Please upload a PNG, JPG or WebP image.";
  }
  return null;
}

export type LogoState = { ok: true } | { error: string } | undefined;

/**
 * Set or clear the BRAND's logo (Milestone 26). Bound in the client as
 * `saveLogo.bind(null, slug)`; `dataUrl` is a resized image data URL, or null to
 * remove it.
 *
 * SECURITY:
 *   • `requireDashboardAccess(slug)` — you may touch this restaurant at all.
 *   • `isAccountOwner` — a BRANCH MANAGER cannot change the whole brand's logo;
 *     only the account (brand) owner can. This is a brand-wide, cross-branch
 *     change, so it's not a per-branch manager's call.
 *   • The image itself is validated (type + size) above.
 */
export async function saveLogo(
  slug: string,
  dataUrl: string | null
): Promise<LogoState> {
  const access = await requireDashboardAccess(slug);
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }
  if (!access.isAccountOwner) {
    return { error: "Only the account owner can change the logo." };
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant?.brandId) {
    return { error: "This restaurant has no brand to attach a logo to." };
  }

  if (dataUrl !== null) {
    const invalid = validateLogoDataUrl(dataUrl);
    if (invalid) return { error: invalid };
  }

  try {
    await updateBrandLogo(restaurant.brandId, dataUrl);
  } catch {
    return { error: "Could not save the logo. Please try again." };
  }

  // The logo shows on the diner-facing feedback page and in Settings.
  revalidatePath(`/r/${slug}/feedback`);
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}
