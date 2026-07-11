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
import { sendEmail } from "@/lib/email";
import { clientIpHash } from "@/lib/request-ip";
import { isThrottled, recordFailure } from "@/lib/login-attempts";
import { issueCode } from "@/lib/verification";

export type ForgotState = { error: string } | undefined;

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
    if (owner) {
      const code = await issueCode(email, "reset");
      await sendEmail({
        to: email,
        subject: "Your ScoreFlow password reset code",
        body:
          `Someone asked to reset the password for your ScoreFlow account.\n\n` +
          `Your reset code is: ${code}\n\n` +
          `Enter it on the reset screen to choose a new password. ` +
          `It expires in 10 minutes.\n\n` +
          `If this wasn't you, you can ignore this email — your password stays the same.`,
      });
    }
    await recordFailure(email, ipHash);
  }

  // Same destination regardless of whether the email exists — no enumeration.
  redirect(`/reset?email=${encodeURIComponent(email)}`);
}
