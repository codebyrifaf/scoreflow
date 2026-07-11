"use server";

/**
 * Server actions for logging in and out.
 *
 * These run ONLY on the server (note the "use server" directive), which is the
 * safe place to touch passwords and set the session cookie. The login form
 * calls `login`; the dashboard's sign-out button calls `logout`.
 */

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getOwnerByEmail } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";

/** Shape the login form reads back: an error message, or nothing on success. */
export type LoginState = { error: string } | undefined;

/**
 * Handle a login form submission.
 *
 * `useActionState` calls this with the previous state and the submitted form.
 * On success we redirect based on the account's role — operators to /admin,
 * owners to THEIR OWN restaurant's dashboard. On bad credentials we return an
 * error message for the form to display.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Normalise the email the same way auth.ts does, so lookups line up.
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    // Verify the credentials and set the session cookie. `redirect: false` means
    // "don't auto-redirect" — we do our own redirect below so we can send the
    // owner to the correct dashboard.
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    // A failed Credentials sign-in throws an AuthError. We show ONE generic
    // message for every kind of failure so we never reveal whether the email
    // exists or the password was the wrong part.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Anything else is an unexpected bug — let it surface.
    throw error;
  }

  // Signed in successfully. Decide where to send them based on their role.
  // We look the account up by email rather than calling auth() here, because the
  // session cookie we just set isn't readable within this same request yet.
  // (redirect() must be OUTSIDE the try/catch: it works by throwing a special
  // signal that Next.js catches, so we don't want our catch block to swallow it.)
  const operator = await getOperatorByEmail(email);
  if (operator) {
    redirect("/admin");
  }
  const owner = await getOwnerByEmail(email);
  const slug = owner?.restaurant.slug;
  redirect(slug ? `/r/${slug}/dashboard` : "/");
}

/**
 * Sign the current owner out and send them to the login page.
 * Wired to a `<form action={logout}>` button on the dashboard.
 */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
