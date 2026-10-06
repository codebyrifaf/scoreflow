"use server";

/**
 * "Forgot password" — step 1 (Milestone 20). Works for BOTH brand owners and
 * branch managers, since both are `Owner` rows.
 *
 * We ALWAYS respond the same way ("if that email has an account, we sent a code")
 * and always move to the reset screen — so an attacker can't use this to discover
 * which emails are registered (user enumeration). A code is only actually emailed
 * when the email really belongs to an owner.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnerByEmail } from "@/lib/owners";
import { sendEmail, emailSystemWorks } from "@/lib/email";
import { clientIpHash } from "@/lib/request-ip";
import { isThrottled, recordFailure } from "@/lib/login-attempts";
import { issueCode } from "@/lib/verification";

/** `email` comes back so the form can keep what was typed (React clears it otherwise). */
export type ForgotState = { error: string; email?: string } | undefined;

/** Said when our mail system is down — identical wording whoever asked. */
const MAIL_DOWN =
  "We couldn't send your reset email just now. Please try again in a few minutes.";

export async function requestReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email." };

  const ipHash = clientIpHash(await headers());
  // Throttle by IP either way, so this can't be used to spray reset emails.
  if (!(await isThrottled(email, ipHash))) {
    const owner = await getOwnerByEmail(email);
    // ⚠️ Did the email actually GO? It used to ignore the answer, so a broken mail
    // setup sent the owner to "check your email" to wait for a code that was never
    // sent. With NO account there's nothing to send, so we check the mail system
    // itself instead — that way this error says "our email is down" and never "this
    // address is registered" (M25).
    let emailWorked: boolean;
    if (owner) {
      const code = await issueCode(email, "reset");
      emailWorked = (await sendEmail({
        to: email,
        subject: "Your ScoreFlow password reset code",
        body:
          `Someone asked to reset the password for your ScoreFlow account.\n\n` +
          `Your reset code is: ${code}\n\n` +
          `Enter it on the reset screen to choose a new password. ` +
          `It expires in 10 minutes.\n\n` +
          `If this wasn't you, you can ignore this email — your password stays the same.`,
      })) !== "failed";
    } else {
      emailWorked = await emailSystemWorks();
    }
    await recordFailure(email, ipHash);
    if (!emailWorked) return { error: MAIL_DOWN, email };
  }

  // Same destination regardless of whether the email exists — no enumeration.
  // (redirect throws — it must not sit inside a try/catch.)
  redirect(`/reset?email=${encodeURIComponent(email)}`);
}
