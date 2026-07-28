/**
 * Change the OPERATOR's login — `npm run operator:set-login <currentEmail> <newEmail> "<newPassword>"`
 *
 * The sibling of `operator:set-password`, which can only change the password. This
 * changes the EMAIL as well, for when you want to move the operator account off the
 * seeded `operator@scoreflow.test` placeholder and onto an address you actually own.
 *
 * Why a script and not a page: there is no "operator settings" UI, deliberately. The
 * operator console is sales-only (M22), and an account that can be re-pointed from
 * inside the app is an account an attacker can re-point once they're in. Changing the
 * platform admin's own identity should require access to the database credentials.
 *
 * Safety, same rules as `operator:set-password`:
 *   • You supply the new password on the command line, so the secret is chosen by YOU
 *     and never lives in the codebase. This prints the DB host so you can see which
 *     database you're changing, but NEVER prints the password.
 *   • It bumps `tokenVersion`, so every existing operator session is signed out (M17).
 *     Moving a login's identity must not leave old sessions alive on the old one.
 *   • It refuses an email already used by another operator OR by a restaurant owner.
 *     `authorize()` checks operators first, so an address present in both tables would
 *     silently shadow the owner's account — a confusing, hard-to-diagnose mess.
 *   • It targets whatever `DATABASE_URL` in `.env` points at. Run `npm run db:where`
 *     first if you're unsure. For production:
 *       DATABASE_URL="<prod>" npm run operator:set-login old@x.com you@real.com "…"
 *
 * Usage:
 *   npm run operator:set-login operator@scoreflow.test you@real.com "a long strong password"
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { validateNewPassword } from "../lib/passwords";

const SALT_ROUNDS = 10; // matches prisma/seed.ts
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function main() {
  const [, , currentArg, newEmailArg, passwordArg] = process.argv;

  if (!currentArg || !newEmailArg || !passwordArg) {
    console.error(
      '\n  Usage: npm run operator:set-login <currentEmail> <newEmail> "<newPassword>"\n' +
        '  e.g.   npm run operator:set-login operator@scoreflow.test you@real.com "my new strong password"\n\n' +
        "  Keeping the same email? Use `npm run operator:set-password` instead.\n"
    );
    process.exit(1);
  }

  const currentEmail = currentArg.trim().toLowerCase();
  const newEmail = newEmailArg.trim().toLowerCase();

  if (!EMAIL_RE.test(newEmail)) {
    console.error(`\n  ✗ "${newEmail}" doesn't look like a valid email address.\n`);
    process.exit(1);
  }

  // Same strength rule as every other password in the app (min 12 chars).
  const weak = validateNewPassword(passwordArg);
  if (weak) {
    console.error(`\n  ✗ ${weak}\n`);
    process.exit(1);
  }

  // Say out loud which database we're about to change — never the password.
  const url = process.env.DATABASE_URL ?? "";
  let host = "(unparseable)";
  try {
    const p = new URL(url);
    host = `${p.host}${p.pathname}`;
  } catch {
    /* leave as unparseable */
  }
  console.log(`\n  Database : ${host}`);

  const operator = await prisma.operator.findUnique({
    where: { email: currentEmail },
  });
  if (!operator) {
    const all = await prisma.operator.findMany({ select: { email: true } });
    console.error(
      `\n  ✗ No operator with email "${currentEmail}".` +
        (all.length
          ? `\n    Operators in this database: ${all.map((o) => o.email).join(", ")}\n`
          : "\n    This database has no operator accounts at all.\n")
    );
    process.exit(1);
  }

  // Only check for collisions if the address is actually changing.
  if (newEmail !== currentEmail) {
    const takenByOperator = await prisma.operator.findUnique({
      where: { email: newEmail },
    });
    if (takenByOperator) {
      console.error(`\n  ✗ Another operator already uses "${newEmail}".\n`);
      process.exit(1);
    }

    // See the header note: an address in BOTH tables would shadow the owner's login.
    const takenByOwner = await prisma.owner.findUnique({
      where: { email: newEmail },
    });
    if (takenByOwner) {
      console.error(
        `\n  ✗ "${newEmail}" is already a restaurant owner's login.` +
          `\n    Pick a different address — an email in both tables would stop that` +
          `\n    owner being able to sign in to their own dashboard.\n`
      );
      process.exit(1);
    }
  }

  const passwordHash = await bcrypt.hash(passwordArg, SALT_ROUNDS);
  await prisma.operator.update({
    where: { id: operator.id },
    // Bumping tokenVersion signs out every existing operator session (M17).
    data: { email: newEmail, passwordHash, tokenVersion: { increment: 1 } },
  });

  console.log(
    `\n  ✓ Operator login updated.` +
      `\n    Email    : ${currentEmail} → ${newEmail}` +
      `\n    Password : changed (not printed)` +
      `\n    Any existing operator session was signed out.` +
      `\n    Sign in at /operator/login with the new email and password.\n`
  );
}

main()
  .catch((err) => {
    console.error("\n  ✗ Failed to update the operator login:", err.message ?? err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
