/**
 * Owner login page, served at `/login`.
 *
 * This is a SERVER component. If someone who's already logged in visits /login,
 * we send them straight to their own home (operator → /admin, brand owner →
 * /b/<slug>, branch manager → their dashboard) — no need to log in again.
 * Otherwise we render the interactive <LoginForm>.
 *
 * This page is PUBLIC — anyone can reach it. That's correct: it's how owners get
 * in. The protection lives on the dashboard, not here.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { signedInHomeHref } from "@/lib/auth-guard";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Already signed in? Skip the form and send them to their own home (operator →
  // /admin, brand owner → /b/<slug>, branch manager → their dashboard).
  //
  // This is a DATABASE-backed check (M17), not just "does the cookie decode?".
  // That matters: a revoked session — e.g. straight after changing your own
  // password, which bumps tokenVersion — still has a perfectly valid-looking
  // cookie. If we trusted it here, we'd send the user to their dashboard, the
  // guard would bounce them back to /login, and they'd loop forever.
  const home = await signedInHomeHref();
  if (home && home !== "/login") {
    redirect(home);
  }

  return (
    // Same premium white aesthetic as the customer feedback page.
    <main className="font-system relative flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
      {/* Way back to the landing page. The wordmark IS the logo (M15) — no icon,
          no emoji; the chevron just makes it read as "back". */}
      <header className="absolute inset-x-0 top-0">
        <nav className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <Link
            href="/"
            className="text-[17px] font-semibold tracking-[-0.02em] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
          >
            <span aria-hidden="true">‹</span> ScoreFlow
          </Link>
        </nav>
      </header>

      <div className="animate-card-in w-full max-w-[430px]">
        <header className="mb-8 text-center">
          {/* Generic heading — both restaurant owners and the operator sign in here.
              No logo, kept intentionally minimal. */}
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Sign in to ScoreFlow
          </h1>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}
