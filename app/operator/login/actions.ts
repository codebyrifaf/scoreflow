"use server";

/**
 * The OPERATOR's own sign-in (Milestone 21) — a separate front door from the
 * customers' `/login`.
 *
 * ── What this does and doesn't buy you ───────────────────────────────────────
 * A separate URL is tidiness and discretion: nothing on the public, customer-facing
 * login hints that an admin console exists. It is NOT the security boundary. The
 * real protection is `requireOperator()` on every operator page — which re-reads
 * the account from the database on every request (M17) — plus the brute-force guard
 * inside `authorize()` that covers BOTH doors equally.
 *
 * ── Why we sign in first, then check ─────────────────────────────────────────
 * The tempting shortcut is "look up the operator; if it's not one, bail out". That
 * bails out FAST (before any bcrypt work), which hands an attacker a timing oracle:
 * a quick 'no' means "that email isn't an operator", a slow one means "it is, but
 * the password was wrong". So instead we always run the normal sign-in (same bcrypt
 * cost, same rate limiting), and only afterwards ask whether the account that just
 * authenticated is actually an operator. If an OWNER's credentials were used here,
 * we immediately revoke the session we just minted and show the same generic error.
 *
 * Note that even if that revocation somehow failed, an owner would gain nothing:
 * `requireOperator()` would still refuse them on every operator page.
 */

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getOperatorByEmail } from "@/lib/operators";

export type OperatorLoginState = { error: string } | undefined;

/** One message for every failure — never reveal which part was wrong. */
const GENERIC = "Invalid email or password.";

export async function operatorLogin(
  _prev: OperatorLoginState,
  formData: FormData
): Promise<OperatorLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    // Normal, hardened sign-in (rate-limited, timing-safe — see auth.ts).
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC };
    throw error; // an unexpected bug — let it surface
  }

  // Authenticated — but is this actually an operator? An owner who wandered in
  // here (or is probing) gets their brand-new session torn up immediately.
  const operator = await getOperatorByEmail(email);
  if (!operator) {
    try {
      await signOut({ redirect: false });
    } catch {
      // Even if this fails, requireOperator() still refuses them everywhere.
    }
    return { error: GENERIC };
  }

  // redirect() throws, so it must live outside the try/catch above.
  redirect("/operator");
}
