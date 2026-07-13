/**
 * Reset the OPERATOR's password — `npm run operator:set-password <email> <newPassword>`
 *
 * The operator password can't be *recovered* (only a bcrypt hash is stored), but it's
 * easy to *reset*. This is the surgical way to do it — unlike re-running the full seed,
 * it touches nothing but the one operator's password.
 *
 * Safety, on purpose:
 *   • You supply the new password on the command line, so the secret is chosen by YOU
 *     and never lives in the codebase. This script prints the DB host (so you can see
 *     which database you're changing) but NEVER prints the password.
 *   • It bumps `tokenVersion`, so any existing operator session is signed out — the
 *     right thing after "I lost my password" (M17 revocation).
 *   • It targets whatever `DATABASE_URL` in `.env` points at. Run `npm run db:where`
 *     first if you're unsure which database that is. To reset PRODUCTION, run it with
 *     the production URL:  DATABASE_URL="<prod>" npm run operator:set-password …
 *
 * Usage:
 *   npm run operator:set-password operator@scoreflow.test "a-long-strong-password"
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { validateNewPassword } from "../lib/passwords";

const SALT_ROUNDS = 10; // matches prisma/seed.ts

async function main() {
  const [, , emailArg, passwordArg] = process.argv;

  if (!emailArg || !passwordArg) {
    console.error(
      '\n  Usage: npm run operator:set-password <email> "<newPassword>"\n' +
        "  e.g.   npm run operator:set-password operator@scoreflow.test \"my new strong password\"\n"
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

  // Same strength rule as everywhere else (min 12 chars).
  const weak = validateNewPassword(passwordArg);
  if (weak) {
    console.error(`\n  ✗ ${weak}\n`);
    process.exit(1);
  }

  // Show which database we're about to change — never the password.
  const url = process.env.DATABASE_URL ?? "";
  let host = "(unparseable)";
  try {
    const p = new URL(url);
    host = `${p.host}${p.pathname}`;
  } catch {
    /* leave as unparseable */
  }
  console.log(`\n  Database : ${host}`);

  const operator = await prisma.operator.findUnique({ where: { email } });
  if (!operator) {
    const all = await prisma.operator.findMany({ select: { email: true } });
    console.error(
      `\n  ✗ No operator with email "${email}".` +
        (all.length
          ? `\n    Operators in this database: ${all.map((o) => o.email).join(", ")}\n`
          : "\n    This database has no operator accounts at all.\n")
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(passwordArg, SALT_ROUNDS);
  await prisma.operator.update({
    where: { id: operator.id },
    // Bumping tokenVersion signs out any existing operator session (M17).
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  console.log(
    `\n  ✓ Password updated for operator "${email}".` +
      `\n    Any existing operator session was signed out.` +
      `\n    Sign in at /operator/login with your new password.\n`
  );
}

main()
  .catch((err) => {
    console.error("\n  ✗ Failed to set the operator password:", err.message ?? err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
