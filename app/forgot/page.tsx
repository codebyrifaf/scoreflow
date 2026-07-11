/**
 * "Forgot password" — served at `/forgot` (Milestone 20). Public.
 */

import Link from "next/link";
import ForgotForm from "./ForgotForm";

export default function ForgotPage() {
  return (
    <main className="font-system relative flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
      <header className="absolute inset-x-0 top-0">
        <nav className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <Link
            href="/login"
            className="text-[17px] font-semibold tracking-[-0.02em] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
          >
            <span aria-hidden="true">‹</span> Sign in
          </Link>
        </nav>
      </header>

      <div className="animate-card-in w-full max-w-[430px]">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Reset your password
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
            Enter your email and we&apos;ll send you a code to set a new password.
          </p>
        </header>

        <ForgotForm />
      </div>
    </main>
  );
}
