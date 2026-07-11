/**
 * Self-serve signup, step 1 — served at `/signup` (Milestone 20).
 *
 * PUBLIC. If someone who's already signed in lands here, send them home instead.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { signedInHomeHref } from "@/lib/auth-guard";
import { TRIAL_DAYS } from "@/lib/subscriptions";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  const home = await signedInHomeHref();
  if (home && home !== "/login") {
    redirect(home);
  }

  return (
    <main className="font-system relative flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
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
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Start your free trial
          </h1>
          <p className="mt-2 text-[15px] text-[#6B7280]">
            {TRIAL_DAYS} days free. No card needed.
          </p>
        </header>

        <SignupForm />
      </div>
    </main>
  );
}
