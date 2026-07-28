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
  createBranch,
  branchHasManager,
  uniqueRestaurantSlug,
  updateRestaurant,
  deleteRestaurantCascade,
} from "@/lib/restaurants";
import {
  getOwnerByEmail,
  updateOwnerPassword,
  createBranchManager,
} from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";
import { validateNewPassword } from "@/lib/passwords";
import { issueCode } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

const SALT_ROUNDS = 10;

/** How long a branch-manager invite link stays valid (M36). Generous — the manager
 *  may not check their email for a day or two; if it lapses, "Forgot password" works. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

/**
 * A random, UNUSABLE password hash.
 *
 * A manager account is created locked: nobody — not even the owner who invited them —
 * knows this value, and it cannot be guessed. The account only becomes usable when the
 * manager follows their invite link and sets a password of their own.
 */
async function lockedPasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
}

/**
 * Issue the one-time invite code and email the link.
 *
 * BEST-EFFORT on purpose: the manager's account already exists by the time we get
 * here, so a mail hiccup must not undo the owner's action. If the email never lands,
 * "Forgot password" issues a fresh code against the same account. We log and move on.
 *
 * Shared by BOTH entry points — naming a manager when the location is created, and
 * attaching one later — so an invite can never drift between the two.
 */
async function inviteManager(
  managerEmail: string,
  brandName: string,
  branchName: string
): Promise<void> {
  try {
    const code = await issueCode(managerEmail, "reset", INVITE_TTL_MS);
    await sendManagerInvite(managerEmail, brandName, branchName, code);
  } catch (err) {
    console.error("[branch] failed to send manager invite:", err);
  }
}

/**
 * Validate a would-be manager's email. Returns an error message, or null.
 *
 * The "already in use" check spans BOTH tables: an address that belongs to any owner
 * (brand or branch) or to an operator can't become a second account, because `email`
 * is globally unique — the database would reject it anyway, and a friendly message
 * beats a caught exception.
 */
async function managerEmailError(email: string): Promise<string | null> {
  if (!email) return "Manager email is required.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if ((await getOwnerByEmail(email)) || (await getOperatorByEmail(email))) {
    return "That email is already in use.";
  }
  return null;
}

export type BranchState =
  | { ok: true }
  | { errors: Record<string, string> }
  | undefined;
export type ResetState = { error: string } | { ok: true } | undefined;
export type DeleteBranchState = { error: string } | { ok: true } | undefined;
export type InviteManagerState = { error: string } | { ok: true } | undefined;

/**
 * Validate the EDIT form's fields (name / slug / threshold).
 *
 * ⚠️ Edit-only. Adding a location no longer asks for a slug (it's derived from the
 * name — see `addBranch`) or a threshold (it defaults to 8 and is tuned in the
 * branch's own Settings). Editing keeps both: an owner may want to tidy a URL before
 * printing QR codes, and the slug field carries its own NFC warning.
 *
 * ⚠️ Review links are NOT read here (M35). All four platforms (Google, Tripadvisor,
 * Yelp, Zomato) are set in the branch's own Settings by whoever runs it — exactly like
 * a solo restaurant — so the branch form doesn't ask for any of them.
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
 * Add a LOCATION to this account — the one and only way a restaurant is created.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ This is the door for the FIRST location as well as the tenth.              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Signup used to create location #1 itself, silently, with no manager — so the first
 * restaurant was structurally unlike every later one and came from different code.
 * Signup now creates the ACCOUNT only, and every location comes through here.
 *
 * ── "Who runs this branch?" ──────────────────────────────────────────────────
 * The form asks, and both answers are first-class:
 *   • `self`   → no manager account at all. The ACCOUNT OWNER runs this location
 *                directly, which the M16 guard already allows. This is the normal
 *                case for someone with one restaurant, and forcing them to invent a
 *                second email address for themselves would have been absurd.
 *   • `invite` → a manager account, created LOCKED, plus an emailed link to set their
 *                own password (M36). ⚠️ We never email a password.
 *
 * Choosing `self` is not a one-way door: `inviteBranchManager` attaches a manager
 * later without disturbing the branch's feedback, tables or QR codes.
 *
 * ── The slug is DERIVED, not typed ───────────────────────────────────────────
 * `uniqueRestaurantSlug(name)` — the same helper signup used. The slug is burned into
 * printed QR codes and NFC chips, so asking a non-technical owner to invent one was
 * a typo waiting to become a reprint. It stays editable on the EDIT form, which warns
 * about exactly that consequence.
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

  const name = String(formData.get("name") ?? "").trim();
  // Anything that isn't an explicit "invite" means the owner runs it — fail towards
  // NOT creating a login, which is the reversible outcome.
  const invite = String(formData.get("managerMode") ?? "self") === "invite";
  const managerEmail = String(formData.get("managerEmail") ?? "")
    .trim()
    .toLowerCase();

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Please give this location a name.";
  if (invite) {
    const emailError = await managerEmailError(managerEmail);
    if (emailError) errors.managerEmail = emailError;
  }
  if (Object.keys(errors).length > 0) return { errors };

  // Derived from the name, and guaranteed free (the DB unique index is still the real
  // backstop). Resolved before the write so a collision becomes "-2", not an error.
  const slug = await uniqueRestaurantSlug(name);

  try {
    await createBranch({
      brandId: brand.id, // ← this is what makes it a location of THIS account
      name,
      slug,
      manager: invite
        ? { email: managerEmail, passwordHash: await lockedPasswordHash() }
        : null,
    });
  } catch {
    return { errors: { form: "Could not add the location. Please try again." } };
  }

  if (invite) await inviteManager(managerEmail, brand.name, name);

  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

/**
 * Attach a manager to a location that ALREADY exists.
 *
 * The other half of "I'll run it myself": an owner who has been running a location
 * personally can hand it to someone at any point, without deleting and recreating the
 * branch — which would destroy its feedback, its tables, and every QR code already
 * printed and stood on a table.
 *
 * ⚠️ The OWNER LOSES NOTHING. `requireDashboardAccess` authorises a brand owner by
 * `restaurant.brandId === owner.brandId`, with no reference to whether a manager
 * exists. This adds a second person with access to one branch; it does not touch the
 * owner's own. That falls out of the existing guard — no code here defends it.
 *
 * Security: the same two checks every action in this file makes — you own this brand,
 * and this branch belongs to it.
 */
export async function inviteBranchManager(
  brandSlug: string,
  branchSlug: string,
  _prev: InviteManagerState,
  formData: FormData
): Promise<InviteManagerState> {
  const access = await requireBrandAccess(brandSlug);
  if (!access.authorized) return { error: "Not authorized." };
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { error: "Brand not found." };

  const branch = await getRestaurantBySlug(branchSlug);
  if (!branch || branch.brandId !== brand.id) {
    return { error: "That location isn't part of your account." };
  }

  // One manager per location. Replacing a manager is a different, more dangerous
  // operation than adding one, so it isn't quietly folded in here — the card offers
  // "Reset password" for a branch that already has someone.
  if (await branchHasManager(branch.id)) {
    return { error: "This location already has a manager." };
  }

  const managerEmail = String(formData.get("managerEmail") ?? "")
    .trim()
    .toLowerCase();
  const emailError = await managerEmailError(managerEmail);
  if (emailError) return { error: emailError };

  try {
    await createBranchManager({
      restaurantId: branch.id,
      email: managerEmail,
      passwordHash: await lockedPasswordHash(),
    });
  } catch {
    return { error: "Could not add the manager. Please try again." };
  }

  await inviteManager(managerEmail, brand.name, branch.name);

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
