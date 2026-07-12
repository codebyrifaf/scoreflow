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
import { isValidGoogleReviewUrl, GOOGLE_REVIEW_URL_ERROR } from "@/lib/review-url";

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
  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  const positiveThresholdRaw = String(formData.get("positiveThreshold") ?? "").trim();
  const alertThresholdRaw = String(formData.get("alertThreshold") ?? "").trim();

  const errors: Record<string, string> = {};

  if (!name) errors.name = "Restaurant name is required.";

  // Must be a real Google review link (M25). Constraining this to Google hosts is
  // what stops /go-review from becoming an open redirect off our own domain.
  if (googleReviewUrl && !isValidGoogleReviewUrl(googleReviewUrl)) {
    errors.googleReviewUrl = GOOGLE_REVIEW_URL_ERROR;
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
      googleReviewUrl: googleReviewUrl || null,
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
