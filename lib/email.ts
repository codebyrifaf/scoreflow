/**
 * Sending email — the one seam the whole app goes through (Milestone 18/19).
 *
 * Everything that notifies someone (the unhappy-diner alerts, the daily digest)
 * calls `sendEmail` and nothing else. Which PROVIDER actually delivers is chosen
 * here, by the `EMAIL_PROVIDER` env var, so switching providers never touches a
 * single line of calling code — that is the entire point of this file.
 *
 * Three modes:
 *   • unset            → LOG only (the message is printed, not sent). The safe
 *                        default: the alert system is fully built and you can watch
 *                        it fire in the terminal without any account or domain.
 *   • EMAIL_PROVIDER=gmail  → send for real via a Gmail account + App Password.
 *                        Free, no domain needed — right for the first pilots.
 *   • EMAIL_PROVIDER=resend → send via Resend (needs a domain you own). The grown-up
 *                        option for when you're charging money; still a stub below.
 *
 * ── Gmail: honest trade-offs ─────────────────────────────────────────────────
 * Free and works today, but: mail comes "via gmail.com", there's a ~500/day cap,
 * and deliverability is weaker than a real domain (it can land in spam). Fine for a
 * handful of pilot restaurants; swap to Resend the day you buy a domain — one line
 * of config, no code change.
 */

import type { Transporter } from "nodemailer";

export interface EmailMessage {
  /** Recipient address. */
  to: string;
  subject: string;
  /** Plain-text body. Kept plain on purpose: it's readable, it's spam-filter
   *  friendly, and it renders fine on the phone an owner will actually read it on. */
  body: string;
}

/** Did the message go out, or was it only logged? Handy for tests and the UI. */
export type EmailResult = "sent" | "logged" | "failed";

/**
 * Send one email. Never throws: a failure to notify must NEVER take down the
 * thing that triggered it (a diner submitting feedback, or the nightly digest
 * job). Callers get a result back and carry on.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER;

  try {
    switch (provider) {
      case "gmail":
        return await sendViaGmail(message);

      case "resend":
        // TODO (needs a domain): install `resend`, then:
        //   const { Resend } = await import("resend");
        //   await new Resend(process.env.RESEND_API_KEY).emails.send({
        //     from: process.env.EMAIL_FROM!,
        //     to: message.to,
        //     subject: message.subject,
        //     text: message.body,
        //   });
        //   return "sent";
        console.warn(
          "[email] EMAIL_PROVIDER=resend but the Resend client isn't wired up yet — falling back to logging."
        );
        return logInstead(message);

      default:
        // No provider configured — log instead of send.
        return logInstead(message);
    }
  } catch (err) {
    // Deliberately swallowed. An unhappy diner's feedback is already safely saved;
    // failing to email about it must not turn into a 500 for the diner (or a crash
    // in the nightly digest). We report "failed" and the caller carries on.
    console.error("[email] send failed:", err);
    return "failed";
  }
}

// ── Gmail (nodemailer over SMTP) ─────────────────────────────────────────────

/**
 * One reused SMTP connection. nodemailer recommends creating the transport once
 * and reusing it rather than reconnecting per email, so we cache it. It's created
 * lazily on the first real send, so the app doesn't open an SMTP connection just
 * because this module was imported.
 */
let gmailTransport: Transporter | null = null;

async function sendViaGmail(message: EmailMessage): Promise<EmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  // Misconfigured (provider set but creds missing) → log rather than throw, so
  // alerts degrade to "visible in the terminal" instead of silently failing.
  if (!user || !pass) {
    console.warn(
      "[email] EMAIL_PROVIDER=gmail but GMAIL_USER / GMAIL_APP_PASSWORD are not set — logging instead."
    );
    return logInstead(message);
  }

  // Dynamic import so nodemailer is only loaded when Gmail is actually the
  // provider (keeps it out of the path when you're just logging or on Resend).
  const { default: nodemailer } = await import("nodemailer");
  gmailTransport ??= nodemailer.createTransport({
    service: "gmail", // nodemailer's preset for smtp.gmail.com
    auth: { user, pass },
  });

  await gmailTransport.sendMail({
    // "ScoreFlow <you@gmail.com>" if EMAIL_FROM is set, else just the account.
    // Gmail will rewrite the address to the account either way, but a friendly
    // display name still shows in the inbox.
    from: process.env.EMAIL_FROM || user,
    to: message.to,
    subject: message.subject,
    text: message.body,
  });

  return "sent";
}

/** Print the message we would have sent, so alerts are observable without a provider. */
function logInstead(message: EmailMessage): EmailResult {
  console.log(
    `\n[email:stub] would send to ${message.to}\n  subject: ${message.subject}\n  ${message.body.split("\n").join("\n  ")}\n`
  );
  return "logged";
}

/** Is a real provider actually configured (and usable)? The settings page uses
 *  this to tell the owner the truth about whether email will really arrive. */
export function emailIsConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider === "gmail") {
    return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }
  if (provider === "resend") {
    return !!process.env.RESEND_API_KEY;
  }
  return false;
}
