/**
 * Health check — `GET /api/health` (Milestone 19 — safety net).
 *
 * Answers one question honestly: **is ScoreFlow actually able to serve a diner
 * right now?** That means checking the database, not just that the server is up —
 * the app can be running perfectly while Neon is asleep, over quota, or
 * unreachable, and in that state every NFC tap fails.
 *
 * Point a free uptime monitor at this (UptimeRobot's free tier checks every 5
 * minutes and emails you). Costs nothing, and it means YOU find out about an
 * outage rather than a restaurant owner phoning you on Saturday night.
 *
 * It deliberately returns NO internal detail — no connection string, no error
 * text, no version. It's a public URL, so it says "ok" or "not ok" and nothing an
 * attacker could use.
 */

import { prisma } from "@/lib/prisma";

// Never cache this — a cached "ok" during an outage is worse than no check at all.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    // The cheapest possible query that proves we can actually reach Postgres.
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      database: "up",
      responseMs: Date.now() - startedAt,
    });
  } catch (err) {
    // Log the real reason for us; tell the world nothing useful.
    console.error("[health] database unreachable:", err);

    return Response.json(
      { status: "error", database: "down" },
      { status: 503 } // a real failure status, so the monitor actually alerts
    );
  }
}
