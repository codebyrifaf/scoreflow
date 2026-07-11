/**
 * `npm run db:where` — which database am I actually pointed at? (Milestone 19)
 *
 * Run this BEFORE anything risky (a seed, a migration, a manual fix). Most
 * "oh no" moments in a project like this aren't complicated — they're just not
 * knowing whether `.env` was aimed at your dev branch or at the live database
 * your paying customers are using.
 *
 * It prints the host (never the password) and a quick census of what's in there,
 * then tells you plainly whether it looks like production.
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

/** Known demo slugs — anything else means this database holds real customers. */
const DEMO_SLUGS = ["fucco", "bella-pizza"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Check your .env.");
    process.exit(1);
  }

  // Strip credentials before printing — the password must never hit the terminal.
  let host = "(unparseable)";
  try {
    const parsed = new URL(url);
    host = `${parsed.host}${parsed.pathname}`;
  } catch {
    /* leave as unparseable */
  }

  const [restaurants, brands, owners, operators, feedback] = await Promise.all([
    prisma.restaurant.findMany({ select: { slug: true }, orderBy: { id: "asc" } }),
    prisma.brand.count(),
    prisma.owner.count(),
    prisma.operator.count(),
    prisma.feedback.count(),
  ]);

  const realRestaurants = restaurants.filter((r) => !DEMO_SLUGS.includes(r.slug));
  const looksLikeProduction = realRestaurants.length > 0 || feedback > 0;

  console.log("");
  console.log(`  Database : ${host}`);
  console.log(`  Branch   : ${host.includes("-pooler") ? "pooled endpoint" : "direct endpoint"}`);
  console.log("");
  console.log(`  Restaurants : ${restaurants.length}${restaurants.length ? `  (${restaurants.map((r) => r.slug).join(", ")})` : ""}`);
  console.log(`  Brands      : ${brands}`);
  console.log(`  Owners      : ${owners}`);
  console.log(`  Operators   : ${operators}`);
  console.log(`  Feedback    : ${feedback}`);
  console.log("");

  if (looksLikeProduction) {
    console.log("  ⚠️  THIS LOOKS LIKE PRODUCTION — it holds real restaurants and/or real");
    console.log("      diner feedback. Do NOT run `npm run seed` or destructive scripts here.");
  } else {
    console.log("  ✅ Looks like a safe dev database (no real restaurants, no feedback).");
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("Could not reach the database:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
