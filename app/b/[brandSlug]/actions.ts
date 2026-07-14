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

import { randomBytes } from "node:crypto";
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
import { validateNewPassword } from "@/lib/passwords";
import { issueCode } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

const SALT_ROUNDS = 10;

/** How long a branch-manager invite link stays valid (M36). Generous — the manager
 *  may not check their email for a day or two; if it lapses, "Forgot password" works. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Email a new branch manager an INVITE to set their own password (Milestone 36).
 *
 * ⚠️ We NEVER email a password. The brand owner no longer sets one at all — instead we
 * create the account with a random, unusable password, then send the manager a one-time
 * link to choose their own. Nobody but the manager ever knows it, and nothing sensitive
 * sits in an inbox. The link reuses the /reset page (same "code + new password" flow),
 * with the code pre-filled in the URL so the manager just picks a password.
 */
async function sendManagerInvite(
  managerEmail: string,
  brandName: string,
  branchName: string,
  code: string
): Promise<void> {
  const link = `${appUrl()}/reset?email=${encodeURIComponent(managerEmail)}&code=${code}`;
  await sendEmail({
    to: managerEmail,
    subject: `You've been added as a manager for ${branchName}`,
    body:
      `You've been set up as the manager for ${branchName} (part of ${brandName}) on ` +
      `ScoreFlow.\n\n` +
      `Set your password to get started:\n${link}\n\n` +
      `This link is valid for 7 days. If it expires, go to the sign-in page and use ` +
      `"Forgot password" — your account is already set up.\n\n` +
      `Your login email is: ${managerEmail}`,
  });
}

export type BranchState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;
export type ResetState = { error: string } | { ok: true } | undefined;
export type DeleteBranchState = { error: string } | { ok: true } | undefined;

/**
 * Validate the shared branch fields (name / slug / threshold).
 *
 * ⚠️ Review links are NOT read here (M35). All four platforms (Google, Tripadvisor,
 * Yelp, Zomato) are set in the branch's own Settings by whoever runs it — exactly like
 * a solo restaurant — so the quick add/edit-branch form doesn't ask for any of them.
 */
function readBranchFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const positiveThresholdRaw = String(formData.get("positiveThreshold") ?? "").trim();
  const positiveThreshold = Number(positiveThresholdRaw);

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Branch name is required.";
  if (!slug) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9-]+$/.test(slug))
    errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens.";
  if (
    !positiveThresholdRaw ||
    !Number.isInteger(positiveThreshold) ||
    positiveThreshold < 1 ||
    positiveThreshold > 10
  )
    errors.positiveThreshold = "Review threshold must be a whole number from 1 to 10.";

  return { name, slug, positiveThreshold, errors };
}

/**
 * Add a branch to this brand, and INVITE its manager to set their own password (M36).
 *
 * The owner supplies only the manager's EMAIL — no password. We create the account
 * with a random, unusable password, then email the manager a one-time link to choose
 * their own. This means: the owner never handles a password, nothing sensitive lands
 * in an inbox, only the manager ever knows their password, and the email is implicitly
 * VERIFIED (they can't activate without receiving the link).
 */
export async function addBranch(
  brandSlug: string,
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { errors: { form: "Not authorized." } };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { errors: { form: "Brand not found." } };

  const { name, slug, positiveThreshold, errors } = readBranchFields(formData);
  const managerEmail = String(formData.get("managerEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!managerEmail) errors.managerEmail = "Manager email is required.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(managerEmail))
    errors.managerEmail = "Enter a valid email address.";

  if (!errors.slug && (await getRestaurantBySlug(slug)))
    errors.slug = "That slug is already taken.";
  if (
    !errors.managerEmail &&
    ((await getOwnerByEmail(managerEmail)) ||
      (await getOperatorByEmail(managerEmail)))
  )
    errors.managerEmail = "That email is already in use.";

  if (Object.keys(errors).length > 0) return { errors };

  // A random, unusable password — the account can't be logged into until the manager
  // sets their own via the invite link. Nobody ever knows this value.
  const placeholderHash = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    SALT_ROUNDS
  );
  try {
    await createRestaurantWithOwner({
      name,
      slug,
      // No review links at creation (M35) — the manager sets all four in Settings.
      googleReviewUrl: null,
      positiveThreshold,
      ownerEmail: managerEmail,
      ownerPasswordHash: placeholderHash,
      brandId: brand.id, // ← this makes it a branch of THIS brand
    });
  } catch {
    return { errors: { form: "Could not add the branch — slug or email may exist." } };
  }

  // Invite the manager to set their password. Reuses the "reset" code flow, with a
  // long TTL. Best-effort: the branch IS created even if the email hiccups — the
  // manager can always use "Forgot password" (their account exists). We just log it.
  try {
    const code = await issueCode(managerEmail, "reset", INVITE_TTL_MS);
    await sendManagerInvite(managerEmail, brand.name, name, code);
  } catch (err) {
    console.error("[addBranch] failed to send manager invite:", err);
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

  const { name, slug, positiveThreshold, errors } = readBranchFields(formData);
  // Slug uniqueness, excluding this branch itself.
  if (!errors.slug) {
    const existing = await getRestaurantBySlug(slug);
    if (existing && existing.id !== branch.id)
      errors.slug = "That slug is already taken by another restaurant.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  try {
    // Review links are NOT touched here (M35) — they live in the branch's Settings.
    await updateRestaurant(branch.id, { name, slug, positiveThreshold });
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
  const weak = validateNewPassword(newPassword);
  if (weak) return { error: weak };

  const manager = await getOwnerByEmail(managerEmail.trim().toLowerCase());
  // The manager must run a branch OF THIS BRAND.
  if (!manager || !manager.restaurant || manager.restaurant.brandId !== brand.id)
    return { error: "That manager isn't part of your brand." };

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  // Also bumps the manager's tokenVersion (M17) → this now genuinely LOCKS THEM
  // OUT of every device immediately. Before, resetting a fired manager's password
  // left their existing session working for up to 30 days.
  await updateOwnerPassword(manager.id, hash);
  return { ok: true };
}
