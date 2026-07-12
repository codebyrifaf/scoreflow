/**
 * The nightly digest job (Milestone 18) — `GET /api/cron/digest`.
 *
 * Sends each brand owner ONE email summarising every branch they own: complaints
 * per branch, how each branch is rating, and what's still waiting on someone.
 * (Branch managers get instant alerts instead — see lib/notifications.ts.)
 *
 * ── Status: SWITCHED ON ─────────────────────────────────────────────────────
 * `vercel.json` schedules this at 07:00 UTC daily, and Vercel Cron automatically
 * sends `Authorization: Bearer $CRON_SECRET`.
 *
 * ⚠️ It only actually sends if BOTH are true in the Vercel env:
 *   • `CRON_SECRET` is set — otherwise this route refuses (503, fail-closed);
 *   • `EMAIL_PROVIDER` (+ credentials) is set — otherwise lib/email.ts only LOGS.
 * Miss either and the job runs but nobody is emailed. This route was written months
 * before anything scheduled it, which meant a brand owner who chose "daily digest"
 * over instant alerts silently received nothing at all.
 *
 * ── Why the secret ──────────────────────────────────────────────────────────
 * This route sends mail to real customers, so it must not be a public URL anyone
 * can hammer to spam your users. It only runs for a caller that presents
 * `CRON_SECRET`. If the secret isn't set at all, we refuse to run rather than
 * defaulting to open — fail closed, never open.
 */

import { sendDailyDigests } from "@/lib/notifications";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // No secret configured → this endpoint is not usable. Better a 503 than an open
  // "email all my customers" button on the public internet.
  if (!secret) {
    return Response.json(
      { error: "Digest job is not configured (CRON_SECRET is unset)." },
      { status: 503 }
    );
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }

  const sent = await sendDailyDigests();
  return Response.json({ ok: true, digestsSent: sent });
}
