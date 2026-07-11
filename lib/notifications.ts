/**
 * Unhappy-diner alerts (Milestone 18) — who gets told, and how often.
 *
 * The product's whole pitch is that complaints get "routed quietly to you". Until
 * now they were routed only to a *database row*: if a diner rated 2/10 and the
 * owner didn't happen to log in, nothing happened at all. This module is the part
 * that actually tells someone.
 *
 * Sending goes through `lib/email.ts`, which currently LOGS instead of sending
 * (no domain yet — see that file). Everything else here is real and working.
 *
 * ── The two rules that make this usable rather than annoying ─────────────────
 *
 * 1. BATCHING IS NOT OPTIONAL. M17 caps review-bombing at 30 submissions per
 *    minute per restaurant. If those are all 1-stars, a naive implementation sends
 *    the owner THIRTY emails, they mute alerts forever, and the feature is dead.
 *    So: at most one alert email per restaurant per cooldown window, carrying
 *    everything that's happened since ("4 unhappy diners in the last hour").
 *
 * 2. THE RIGHT PERSON, AT THE RIGHT RHYTHM. A branch manager gets the instant
 *    ping — they can walk over and fix it tonight. A brand owner with four
 *    branches gets ONE daily digest, because twenty instant emails a day is the
 *    same as no emails at all. (They can opt into instant if they want it.)
 */

import { prisma } from "./prisma";
import { sendEmail } from "./email";
import {
  getUnalertedComplaints,
  lastAlertAtFor,
  markAlerted,
  complaintSummaryFor,
} from "./feedback";
import { getAlertRecipientsForRestaurant, getDigestRecipients } from "./owners";

/** At most one alert email per restaurant per this long. See rule 1 above. */
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * How far back an alert will ever look. Stops a restaurant that just switched
 * alerts on (or raised its `alertThreshold`) from emailing out a year of history
 * in one go.
 */
const ALERT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

/** The window the daily digest summarises. */
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A diner was unhappy at this restaurant — tell whoever should know.
 *
 * Called from the feedback API inside `after()`, so it runs AFTER the diner has
 * already got their "thank you" — their submission is never slowed down or failed
 * by our email problems.
 */
export async function notifyComplaint(restaurantId: number): Promise<void> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, slug: true, alertThreshold: true },
    });
    if (!restaurant) return;

    // Rule 1: are we still inside the cooldown from the last alert? If so, do
    // nothing now — these complaints stay un-alerted and will be swept into the
    // next batch (or the daily digest), rather than firing a separate email each.
    const lastAlert = await lastAlertAtFor(restaurantId);
    if (lastAlert && Date.now() - lastAlert.getTime() < ALERT_COOLDOWN_MS) {
      return;
    }

    const complaints = await getUnalertedComplaints(
      restaurantId,
      restaurant.alertThreshold,
      new Date(Date.now() - ALERT_LOOKBACK_MS)
    );
    if (complaints.length === 0) return;

    const recipients = await getAlertRecipientsForRestaurant(restaurantId);
    // Even with nobody to email (everyone muted alerts), we still stamp the rows —
    // otherwise they'd pile up and ambush whoever turns alerts back on later.
    if (recipients.length > 0) {
      const subject =
        complaints.length === 1
          ? `${restaurant.name}: an unhappy diner (${complaints[0].rating}/10)`
          : `${restaurant.name}: ${complaints.length} unhappy diners`;

      const body = buildComplaintEmail(restaurant.name, restaurant.slug, complaints);

      // Sequential on purpose — these lists are tiny (one or two managers), and it
      // keeps us well clear of any provider's per-second rate limit.
      for (const person of recipients) {
        await sendEmail({ to: person.email, subject, body });
      }
    }

    await markAlerted(complaints.map((c) => c.id));
  } catch (err) {
    // An alert failing must never break feedback collection. Log and move on.
    console.error("[notifications] notifyComplaint failed:", err);
  }
}

/** The plain-text body of an instant alert. */
function buildComplaintEmail(
  restaurantName: string,
  slug: string,
  complaints: { rating: number; table: string | null; orderNumber: string; comment: string; tags: string[] }[]
): string {
  const lines = [
    complaints.length === 1
      ? `A diner at ${restaurantName} wasn't happy.`
      : `${complaints.length} diners at ${restaurantName} weren't happy.`,
    "",
  ];

  for (const c of complaints) {
    lines.push(`  ${c.rating}/10 — order ${c.orderNumber}${c.table ? `, table ${c.table}` : ""}`);
    if (c.tags.length) lines.push(`  Tagged: ${c.tags.join(", ")}`);
    if (c.comment) lines.push(`  "${c.comment}"`);
    lines.push("");
  }

  lines.push(
    `Open your dashboard to see the details and mark these as resolved:`,
    `${appUrl()}/r/${slug}/dashboard`,
    "",
    `You can turn these alerts off, or change what counts as a complaint, on your settings page.`
  );
  return lines.join("\n");
}

/**
 * The DAILY DIGEST — one email per person, covering everything they oversee.
 *
 *   • a BRAND OWNER gets every branch, side by side;
 *   • a BRANCH MANAGER who opted in gets their one restaurant.
 *
 * It is also the **safety net** for the instant alerts. Because those are batched
 * behind a cooldown, a burst of complaints can leave a tail that wasn't emailed at
 * the moment it arrived. The digest reports on everything that happened in the
 * window regardless of `alertedAt`, so nothing can quietly go unreported.
 *
 * Run by the cron route. Returns how many digests went out.
 */
export async function sendDailyDigests(): Promise<number> {
  const since = new Date(Date.now() - DIGEST_WINDOW_MS);
  const recipients = await getDigestRecipients();
  let sent = 0;

  for (const person of recipients) {
    // Which restaurants does this person oversee, and where do we link them?
    let heading: string;
    let link: string;
    let branches: { id: number; name: string; alertThreshold: number }[];

    if (person.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: person.brandId },
        select: {
          name: true,
          slug: true,
          restaurants: {
            select: { id: true, name: true, alertThreshold: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!brand) continue;
      heading = `Yesterday across ${brand.name}`;
      link = `${appUrl()}/b/${brand.slug}`;
      branches = brand.restaurants;
    } else if (person.restaurantId) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: person.restaurantId },
        select: { id: true, name: true, slug: true, alertThreshold: true },
      });
      if (!restaurant) continue;
      heading = `Yesterday at ${restaurant.name}`;
      link = `${appUrl()}/r/${restaurant.slug}/dashboard`;
      branches = [restaurant];
    } else {
      continue; // an owner scoped to nothing — shouldn't happen
    }

    if (branches.length === 0) continue;

    const rows = await Promise.all(
      branches.map(async (branch) => ({
        name: branch.name,
        ...(await complaintSummaryFor(branch.id, branch.alertThreshold, since)),
      }))
    );

    const totalComplaints = rows.reduce((n, r) => n + r.newComplaints, 0);
    const totalOpen = rows.reduce((n, r) => n + r.stillOpen, 0);

    const lines = [
      `${heading}:`,
      "",
      ...rows.map((r) => {
        const avg =
          r.avgRating === null ? "no ratings" : `avg ${r.avgRating.toFixed(1)}/10`;
        return `  ${r.name} — ${avg}, ${r.newComplaints} new complaint${r.newComplaints === 1 ? "" : "s"}, ${r.stillOpen} still open`;
      }),
      "",
      `${totalComplaints} new complaint${totalComplaints === 1 ? "" : "s"}, ${totalOpen} still waiting on someone.`,
      "",
      link,
    ];

    await sendEmail({
      to: person.email,
      subject: `${totalComplaints} new complaint${totalComplaints === 1 ? "" : "s"} yesterday`,
      body: lines.join("\n"),
    });
    sent++;
  }

  return sent;
}

/** The public URL to link back to. Vercel sets VERCEL_URL automatically. */
function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
