"use server";

/**
 * Brand-owner server actions (Milestone 16): add / edit / delete a branch, and
 * reset a branch manager's password.
 *
 * SECURITY — every action does two checks, never trusting the client:
 *   1. `requireBrandAccess(brandSlug)` → you are THIS brand's owner.
 *   2. the target branch / manager actually belongs to THIS brand.
 * So a brand owner can only ever manage their own brand's branches.
 */

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireBrandAccess } from "@/lib/auth-guard";
import { getBrandBySlug } from "@/lib/brands";
import {
  getRestaurantBySlug,
  createRestaurantWithOwner,
  updateRestaurant,
  deleteRestaurantCascade,
} from "@/lib/restaurants";
import { getOwnerByEmail, updateOwnerPassword } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";

const SALT_ROUNDS = 10;

export type BranchState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;
export type ResetState = { error: string } | { ok: true } | undefined;
export type DeleteBranchState = { error: string } | { ok: true } | undefined;

/** Validate the shared branch fields (name / slug / Google URL / threshold). */
function readBranchFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  const reviewThresholdRaw = String(formData.get("reviewThreshold") ?? "").trim();
  const reviewThreshold = Number(reviewThresholdRaw);

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Branch name is required.";
  if (!slug) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9-]+$/.test(slug))
    errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens.";
  if (googleReviewUrl && !/^https?:\/\/.+/.test(googleReviewUrl))
    errors.googleReviewUrl = "Enter a valid URL starting with http:// or https://.";
  if (
    !reviewThresholdRaw ||
    !Number.isInteger(reviewThreshold) ||
    reviewThreshold < 1 ||
    reviewThreshold > 10
  )
    errors.reviewThreshold = "Review threshold must be a whole number from 1 to 10.";

  return { name, slug, googleReviewUrl, reviewThreshold, errors };
}

/** Add a branch to this brand (+ its branch-manager login). */
export async function addBranch(
  brandSlug: string,
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { errors: { form: "Not authorized." } };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { errors: { form: "Brand not found." } };

  const { name, slug, googleReviewUrl, reviewThreshold, errors } =
    readBranchFields(formData);
  const managerEmail = String(formData.get("managerEmail") ?? "")
    .trim()
    .toLowerCase();
  const managerPassword = String(formData.get("managerPassword") ?? "");

  if (!managerEmail) errors.managerEmail = "Manager email is required.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(managerEmail))
    errors.managerEmail = "Enter a valid email address.";
  if (managerPassword.length < 8)
    errors.managerPassword = "Password must be at least 8 characters.";

  if (!errors.slug && (await getRestaurantBySlug(slug)))
    errors.slug = "That slug is already taken.";
  if (
    !errors.managerEmail &&
    ((await getOwnerByEmail(managerEmail)) ||
      (await getOperatorByEmail(managerEmail)))
  )
    errors.managerEmail = "That email is already in use.";

  if (Object.keys(errors).length > 0) return { errors };

  const ownerPasswordHash = await bcrypt.hash(managerPassword, SALT_ROUNDS);
  try {
    await createRestaurantWithOwner({
      name,
      slug,
      googleReviewUrl: googleReviewUrl || null,
      reviewThreshold,
      ownerEmail: managerEmail,
      ownerPasswordHash,
      brandId: brand.id, // ← this makes it a branch of THIS brand
    });
  } catch {
    return { errors: { form: "Could not add the branch — slug or email may exist." } };
  }

  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

/** Edit a branch's settings. `currentSlug` identifies which branch. */
export async function editBranch(
  brandSlug: string,
  currentSlug: string,
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { errors: { form: "Not authorized." } };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { errors: { form: "Brand not found." } };

  // The branch must belong to THIS brand.
  const branch = await getRestaurantBySlug(currentSlug);
  if (!branch || branch.brandId !== brand.id)
    return { errors: { form: "That branch isn't part of your brand." } };

  const { name, slug, googleReviewUrl, reviewThreshold, errors } =
    readBranchFields(formData);
  // Slug uniqueness, excluding this branch itself.
  if (!errors.slug) {
    const existing = await getRestaurantBySlug(slug);
    if (existing && existing.id !== branch.id)
      errors.slug = "That slug is already taken by another restaurant.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await updateRestaurant(branch.id, {
      name,
      slug,
      googleReviewUrl: googleReviewUrl || null,
      reviewThreshold,
    });
  } catch {
    return { errors: { form: "Could not save changes." } };
  }

  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

/** Delete a branch (typed-slug confirm). `currentSlug` identifies which branch. */
export async function deleteBranch(
  brandSlug: string,
  currentSlug: string,
  _prev: DeleteBranchState,
  formData: FormData
): Promise<DeleteBranchState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { error: "Not authorized." };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { error: "Brand not found." };

  const branch = await getRestaurantBySlug(currentSlug);
  if (!branch || branch.brandId !== brand.id)
    return { error: "That branch isn't part of your brand." };

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== currentSlug)
    return { error: `Type “${currentSlug}” exactly to confirm deletion.` };

  try {
    await deleteRestaurantCascade(branch.id);
  } catch {
    return { error: "Could not delete the branch. Please try again." };
  }

  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

/** Reset a branch manager's password. `managerEmail` identifies which manager. */
export async function resetManagerPassword(
  brandSlug: string,
  managerEmail: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { error: "Not authorized." };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { error: "Brand not found." };

  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 8)
    return { error: "Password must be at least 8 characters." };

  const manager = await getOwnerByEmail(managerEmail.trim().toLowerCase());
  // The manager must run a branch OF THIS BRAND.
  if (!manager || !manager.restaurant || manager.restaurant.brandId !== brand.id)
    return { error: "That manager isn't part of your brand." };

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateOwnerPassword(manager.id, hash);
  return { ok: true };
}
