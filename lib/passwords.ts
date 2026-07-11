/**
 * The password policy, in one place (Milestone 17).
 *
 * Every screen that sets a password — the operator creating a restaurant or a
 * brand, a brand owner adding a branch, either of them resetting someone's
 * password, and an owner changing their own — imports this, so the rule can't
 * drift between them.
 *
 * Why 12 and not 8: until M17 there was NO rate limit on login, so an 8-character
 * minimum with no complexity rule (`password`, `12345678`, and the restaurant's
 * own name all passed) was the only thing between an attacker and an account. The
 * brute-force guard now caps guessing (see lib/login-attempts.ts), and a longer
 * minimum raises the floor. Length beats complexity rules — a longer passphrase is
 * both easier to remember and harder to guess than "P@ssw0rd".
 *
 * Note this applies to NEWLY-SET passwords only. Existing shorter passwords keep
 * working; they're only re-checked the next time someone changes one.
 */

/** Minimum characters for any newly-set password. (Was 8 before M17.) */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Check a new password. Returns an error message, or `null` if it's acceptable.
 * Callers put the message straight into their form's error field.
 */
export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
