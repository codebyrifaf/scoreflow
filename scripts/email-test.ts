/**
 * `npm run email:test you@example.com` — send ONE real test email (Milestone 19).
 *
 * Use this the moment you've pasted your Gmail App Password into .env, to prove
 * delivery actually works BEFORE you trust it with real alerts. It goes through
 * the exact same `sendEmail` adapter the app uses, so if this lands in your inbox,
 * so will the unhappy-diner alerts.
 *
 *   npm run email:test your.name@gmail.com
 *
 * Reads EMAIL_PROVIDER / GMAIL_USER / GMAIL_APP_PASSWORD from .env like everything
 * else. If EMAIL_PROVIDER isn't set, it will just LOG (no send) — which is itself a
 * useful answer: it tells you the provider isn't switched on yet.
 */

import "dotenv/config";
import { sendEmail, emailIsConfigured } from "../lib/email";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run email:test <recipient-email>");
    process.exit(1);
  }

  console.log(`Provider: ${process.env.EMAIL_PROVIDER ?? "(none — will log only)"}`);
  console.log(`Configured: ${emailIsConfigured() ? "yes" : "no"}`);
  console.log(`Sending a test message to ${to} …\n`);

  const result = await sendEmail({
    to,
    subject: "ScoreFlow test email",
    body:
      "This is a test from ScoreFlow.\n\n" +
      "If you're reading this in your inbox, email delivery is working and your " +
      "unhappy-diner alerts will arrive here too.\n\n" +
      "— ScoreFlow",
  });

  console.log(`\nResult: ${result}`);
  if (result === "sent") {
    console.log("✅ Sent. Check the inbox (and the spam folder the first time).");
  } else if (result === "logged") {
    console.log(
      "ℹ️  Only logged, not sent — set EMAIL_PROVIDER=gmail (+ GMAIL_USER / GMAIL_APP_PASSWORD) in .env to send for real."
    );
  } else {
    console.log(
      "❌ Failed to send. Most common cause: the App Password is wrong, or 2-Step Verification isn't on for that Google account."
    );
    process.exitCode = 1;
  }
}

main();
