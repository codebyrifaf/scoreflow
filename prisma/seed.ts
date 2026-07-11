/**
 * Database seed — inserts the starter restaurants AND their owner login accounts
 * so there's data to test with.
 *
 * Safe to run repeatedly: it UPSERTS by unique keys (restaurant `slug`, owner
 * `email`), so re-running updates the existing rows instead of creating
 * duplicates. Re-running also RESETS each owner's password back to the known
 * test value below — handy if you forget it.
 *
 * Run it with:  npm run seed
 *
 * Production (Milestone 14): this seed is prod-safe.
 *   - The operator email/password come from OPERATOR_EMAIL / OPERATOR_PASSWORD
 *     (falling back to the local dev values), so a prod run sets a STRONG secret.
 *   - The demo restaurants (fucco / bella-pizza) are only created when
 *     SEED_DEMO=true — a real production seed adds no demo data, just the operator.
 *
 * Prod example:
 *   DATABASE_URL="<prod>" OPERATOR_PASSWORD="<strong-secret>" npm run seed
 */

// The seed runs as a plain script (outside Next.js), so we load `.env` ourselves
// BEFORE importing the Prisma client (which reads DATABASE_URL at import time).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * bcrypt "cost factor": how much work hashing does. 10 is a sensible default —
 * slow enough to frustrate password guessing, fast enough for a login form.
 */
const SALT_ROUNDS = 10;

async function main() {
  // Demo restaurants (fucco / bella-pizza) with their owner + tables — ONLY seeded
  // when SEED_DEMO=true, so a real production seed adds no demo data. These are
  // TEST credentials for local development only.
  const includeDemo = process.env.SEED_DEMO === "true";
  const restaurants = includeDemo
    ? [
    {
      slug: "fucco",
      name: "Fucco",
      // Placeholder review links — swap for the real Google review URLs later.
      googleReviewUrl:
        "https://search.google.com/local/writereview?placeid=PLACEHOLDER_FUCCO",
      // Ratings >= 8 get the Google review nudge; below 8 → private screen (M7).
      reviewThreshold: 8,
      owner: { email: "owner@fucco.test", password: "fucco-dev-2026" },
      // Sample tables + their NFC links (Milestone 8).
      tables: ["1", "2", "3"],
    },
    {
      slug: "bella-pizza",
      name: "Bella Pizza",
      googleReviewUrl:
        "https://search.google.com/local/writereview?placeid=PLACEHOLDER_BELLA_PIZZA",
      reviewThreshold: 8,
      owner: { email: "owner@bella-pizza.test", password: "bella-dev-2026" },
      tables: ["1", "2"],
    },
      ]
    : [];

  if (!includeDemo) {
    console.log(
      "No demo restaurants seeded (set SEED_DEMO=true to include fucco/bella-pizza)."
    );
  }

  for (const r of restaurants) {
    // 1. Upsert the restaurant and keep the returned row so we know its `id`
    //    (we need that id to link the owner to this restaurant).
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        googleReviewUrl: r.googleReviewUrl,
        reviewThreshold: r.reviewThreshold,
      },
      create: {
        slug: r.slug,
        name: r.name,
        googleReviewUrl: r.googleReviewUrl,
        reviewThreshold: r.reviewThreshold,
      },
    });
    console.log(
      `Seeded restaurant: ${restaurant.name}  (slug: ${restaurant.slug})`
    );

    // 2. Hash the owner's password before storing it. We NEVER save the raw
    //    password — only this one-way bcrypt hash. Login later re-hashes what
    //    the user types and compares, so the plain password is never persisted.
    const passwordHash = await bcrypt.hash(r.owner.password, SALT_ROUNDS);

    // 3. Upsert the owner account, tied to THIS restaurant's id.
    await prisma.owner.upsert({
      where: { email: r.owner.email },
      update: { passwordHash, restaurantId: restaurant.id },
      create: {
        email: r.owner.email,
        passwordHash,
        restaurantId: restaurant.id,
      },
    });
    console.log(
      `  ↳ Owner login: ${r.owner.email}  (password: ${r.owner.password})`
    );

    // Upsert this restaurant's sample tables (Milestone 8). Idempotent via the
    // compound unique [restaurantId, label].
    for (const label of r.tables) {
      await prisma.table.upsert({
        where: {
          restaurantId_label: { restaurantId: restaurant.id, label },
        },
        update: {},
        create: { restaurantId: restaurant.id, label },
      });
    }
    console.log(`  ↳ Tables: ${r.tables.join(", ")}`);
  }

  // ── Platform operator (Milestone 6) ─────────────────────────────────────────
  // A single admin login used to manage restaurants at /admin. It is NOT tied to
  // any restaurant. Credentials come from env for production (OPERATOR_EMAIL /
  // OPERATOR_PASSWORD), falling back to the local dev values.
  const operator = {
    email: (process.env.OPERATOR_EMAIL ?? "operator@scoreflow.test")
      .trim()
      .toLowerCase(),
    password: process.env.OPERATOR_PASSWORD ?? "operator-dev-2026",
  };
  const operatorPasswordHash = await bcrypt.hash(operator.password, SALT_ROUNDS);
  await prisma.operator.upsert({
    where: { email: operator.email },
    update: { passwordHash: operatorPasswordHash },
    create: { email: operator.email, passwordHash: operatorPasswordHash },
  });
  console.log(
    `Seeded operator login: ${operator.email}  (password: ${operator.password})`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
