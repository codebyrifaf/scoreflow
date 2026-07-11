"use server";

/**
 * Server action for the operator admin dashboard: create a new restaurant plus
 * its owner login.
 *
 * Runs ONLY on the server. It re-checks that the caller is an operator (never
 * trust that the form was only shown to operators), validates every field, and
 * on success writes the restaurant + owner in one transaction.
 */

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireOperator } from "@/lib/auth-guard";
import {
  getRestaurantBySlug,
  createRestaurantWithOwner,
  updateRestaurant,
  deleteRestaurantCascade,
} from "@/lib/restaurants";
import { getOwnerByEmail, updateOwnerPassword } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";
import { validateNewPassword } from "@/lib/passwords";
import {
  getBrandBySlug,
  createBrandWithOwner,
  deleteBrandCascade,
} from "@/lib/brands";

/**
 * What the form reads back:
 *   - success → `{ ok: true, message }`
 *   - failure → `{ ok: false, errors }` where `errors` maps a field name
 *               ("name" | "slug" | "googleReviewUrl" | "ownerEmail" |
 *                "ownerPassword" | "form") to a message.
 */
export type CreateState =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string> }
  | undefined;

const SALT_ROUNDS = 10;

export async function createRestaurant(
  _prevState: CreateState,
  formData: FormData
): Promise<CreateState> {
  // Defense in depth: only operators may create restaurants, even though the UI
  // is only shown to operators.
  const access = await requireOperator();
  if (!access.authorized) {
    return { ok: false, errors: { form: "You are not authorized to do this." } };
  }

  // Read + normalise inputs.
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  const reviewThresholdRaw = String(formData.get("reviewThreshold") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "")
    .trim()
    .toLowerCase();
  const ownerPassword = String(formData.get("ownerPassword") ?? "");

  // Validate. We collect ALL errors so the form can show them at once.
  const errors: Record<string, string> = {};

  if (!name) errors.name = "Restaurant name is required.";

  if (!slug) {
    errors.slug = "Slug is required.";
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.slug =
      "Slug can only contain lowercase letters, numbers, and hyphens.";
  }

  if (googleReviewUrl && !/^https?:\/\/.+/.test(googleReviewUrl)) {
    errors.googleReviewUrl =
      "Enter a valid URL starting with http:// or https:// (or leave it blank).";
  }

  // Smart review routing threshold (M7): a whole number 1–10.
  const reviewThreshold = Number(reviewThresholdRaw);
  if (
    !reviewThresholdRaw ||
    !Number.isInteger(reviewThreshold) ||
    reviewThreshold < 1 ||
    reviewThreshold > 10
  ) {
    errors.reviewThreshold =
      "Review threshold must be a whole number from 1 to 10.";
  }

  if (!ownerEmail) {
    errors.ownerEmail = "Owner email is required.";
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    errors.ownerEmail = "Enter a valid email address.";
  }

  const weakPassword = validateNewPassword(ownerPassword);
  if (weakPassword) {
    errors.ownerPassword = weakPassword;
  }

  // Uniqueness checks (friendly messages). The database's unique constraints are
  // the real backstop; these just give nicer errors before we try to write.
  if (!errors.slug && (await getRestaurantBySlug(slug))) {
    errors.slug = "That slug is already taken — pick another.";
  }
  if (
    !errors.ownerEmail &&
    ((await getOwnerByEmail(ownerEmail)) ||
      (await getOperatorByEmail(ownerEmail)))
  ) {
    errors.ownerEmail = "That email is already in use.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Hash the owner's password here (auth concern), then hand the data-access
  // layer only the hash — never the raw password.
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, SALT_ROUNDS);

  try {
    await createRestaurantWithOwner({
      name,
      slug,
      googleReviewUrl: googleReviewUrl || null,
      reviewThreshold,
      ownerEmail,
      ownerPasswordHash,
    });
  } catch {
    // Backstop in case two operators raced on the same slug/email.
    return {
      ok: false,
      errors: {
        form: "Could not create the restaurant — the slug or email may already exist.",
      },
    };
  }

  // Refresh the /admin list so the new restaurant shows up immediately.
  revalidatePath("/admin");

  return {
    ok: true,
    message: `Added “${name}” at /r/${slug}. Owner login: ${ownerEmail}`,
  };
}

/** What the delete-confirmation form reads back. */
export type DeleteState = { error: string } | { ok: true } | undefined;

/**
 * Permanently delete a restaurant (Milestone 11). Bound in the client as
 * `deleteRestaurant.bind(null, slug)`, so `useActionState` calls it with
 * (prevState, formData).
 *
 * Safeguards (never trust the client): operator-only, and the operator must have
 * typed the restaurant's EXACT slug into the `confirm` field. Only then do we run
 * the transactional cascade delete.
 */
export async function deleteRestaurant(
  slug: string,
  _prevState: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  // The typed confirmation must match the slug EXACTLY.
  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== slug) {
    return { error: `Type “${slug}” exactly to confirm deletion.` };
  }

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return { error: "Restaurant not found (it may already be deleted)." };
  }

  try {
    await deleteRestaurantCascade(restaurant.id);
  } catch {
    return { error: "Could not delete the restaurant. Please try again." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** What the edit form reads back: success, or per-field errors. */
export type EditState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;

/**
 * Edit a restaurant's config (Milestone 12). Bound in the client as
 * `editRestaurant.bind(null, id)`. Operator-only. Same validation as creating,
 * except: no owner fields, and the slug-uniqueness check EXCLUDES this restaurant
 * (so keeping your own slug isn't a "taken" conflict).
 */
export async function editRestaurant(
  id: number,
  _prevState: EditState,
  formData: FormData
): Promise<EditState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { errors: { form: "You are not authorized to do this." } };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  const reviewThresholdRaw = String(formData.get("reviewThreshold") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Restaurant name is required.";
  if (!slug) {
    errors.slug = "Slug is required.";
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.slug =
      "Slug can only contain lowercase letters, numbers, and hyphens.";
  }
  if (googleReviewUrl && !/^https?:\/\/.+/.test(googleReviewUrl)) {
    errors.googleReviewUrl =
      "Enter a valid URL starting with http:// or https:// (or leave it blank).";
  }
  const reviewThreshold = Number(reviewThresholdRaw);
  if (
    !reviewThresholdRaw ||
    !Number.isInteger(reviewThreshold) ||
    reviewThreshold < 1 ||
    reviewThreshold > 10
  ) {
    errors.reviewThreshold =
      "Review threshold must be a whole number from 1 to 10.";
  }

  // Slug uniqueness — but a restaurant keeping its OWN slug is fine.
  if (!errors.slug) {
    const existing = await getRestaurantBySlug(slug);
    if (existing && existing.id !== id) {
      errors.slug = "That slug is already taken by another restaurant.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await updateRestaurant(id, {
      name,
      slug,
      googleReviewUrl: googleReviewUrl || null,
      reviewThreshold,
    });
  } catch {
    return {
      errors: { form: "Could not save changes — the slug may already exist." },
    };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** What the reset-password form reads back. */
export type ResetState = { error: string } | { ok: true } | undefined;

/**
 * Operator resets an OWNER's password (Milestone 13 — "forgot password" without
 * email). Bound in the client as `resetOwnerPassword.bind(null, ownerEmail)`.
 *
 * This is the recovery path for a locked-out owner: the operator sets a new
 * password (same as onboarding — they already hand out credentials) and passes
 * it to the owner, who then changes it via "Change password". Operator-only; the
 * operator still can't see the owner's dashboard, only re-issue credentials.
 */
export async function resetOwnerPassword(
  ownerEmail: string,
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  const weak = validateNewPassword(newPassword);
  if (weak) {
    return { error: weak };
  }

  const owner = await getOwnerByEmail(ownerEmail.trim().toLowerCase());
  if (!owner) {
    return { error: "Owner account not found." };
  }

  const hash = await bcrypt.hash(newPassword, 10);
  // Also bumps the owner's tokenVersion (M17), so this genuinely LOCKS THEM OUT
  // of every device at once — the whole point of a reset. Before, a reset changed
  // the hash but left every existing session alive for up to 30 days.
  await updateOwnerPassword(owner.id, hash);

  return { ok: true };
}

/** What the add-brand form reads back. */
export type BrandState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;

/**
 * Operator creates a BRAND + its brand-owner login (Milestone 16). The brand
 * owner then adds branches themselves at /b/<slug>.
 */
export async function createBrand(
  _prevState: BrandState,
  formData: FormData
): Promise<BrandState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { errors: { form: "You are not authorized to do this." } };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const ownerEmail = String(formData.get("ownerEmail") ?? "")
    .trim()
    .toLowerCase();
  const ownerPassword = String(formData.get("ownerPassword") ?? "");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Brand name is required.";
  if (!slug) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9-]+$/.test(slug))
    errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens.";
  if (!ownerEmail) errors.ownerEmail = "Brand owner email is required.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail))
    errors.ownerEmail = "Enter a valid email address.";
  const weakBrandPassword = validateNewPassword(ownerPassword);
  if (weakBrandPassword) errors.ownerPassword = weakBrandPassword;

  if (!errors.slug && (await getBrandBySlug(slug)))
    errors.slug = "That brand slug is already taken.";
  if (
    !errors.ownerEmail &&
    ((await getOwnerByEmail(ownerEmail)) ||
      (await getOperatorByEmail(ownerEmail)))
  )
    errors.ownerEmail = "That email is already in use.";

  if (Object.keys(errors).length > 0) return { errors };

  const ownerPasswordHash = await bcrypt.hash(ownerPassword, SALT_ROUNDS);
  try {
    await createBrandWithOwner({ name, slug, ownerEmail, ownerPasswordHash });
  } catch {
    return { errors: { form: "Could not create the brand — slug or email may exist." } };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Permanently delete a BRAND and everything under it (Milestone 16). Bound in the
 * client as `deleteBrand.bind(null, slug)`, so `useActionState` calls it with
 * (prevState, formData). Reuses `DeleteState`.
 *
 * Same safeguards as deleting a restaurant (never trust the client): operator-only,
 * and the operator must type the brand's EXACT slug. Only then do we run the
 * transactional cascade, which also removes every branch + their feedback, tables,
 * and logins (see `deleteBrandCascade`).
 */
export async function deleteBrand(
  slug: string,
  _prevState: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const access = await requireOperator();
  if (!access.authorized) {
    return { error: "You are not authorized to do this." };
  }

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== slug) {
    return { error: `Type “${slug}” exactly to confirm deletion.` };
  }

  const brand = await getBrandBySlug(slug);
  if (!brand) {
    return { error: "Brand not found (it may already be deleted)." };
  }

  try {
    await deleteBrandCascade(brand.id);
  } catch {
    return { error: "Could not delete the brand. Please try again." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
