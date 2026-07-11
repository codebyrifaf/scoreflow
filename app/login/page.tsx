/**
 * Owner login page, served at `/login`.
 *
 * This is a SERVER component. If someone who's already logged in visits /login,
 * we send them straight to their own dashboard (no need to log in again).
 * Otherwise we render the interactive <LoginForm>.
 *
 * This page is PUBLIC — anyone can reach it. That's correct: it's how owners get
 * in. The protection lives on the dashboard, not here.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();

  // Already signed in? Skip the form and go to their dashboard.
  if (session?.user?.restaurantSlug) {
    redirect(`/r/${session.user.restaurantSlug}/dashboard`);
  }

  return (
    // Same premium white aesthetic as the customer feedback page.
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
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
