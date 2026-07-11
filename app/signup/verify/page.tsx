/**
 * Self-serve signup, step 2 (the code) — served at `/signup/verify` (Milestone 20).
 *
 * PUBLIC. Reads the email from the query (set by step 1). If it's missing — someone
 * landed here directly — send them back to the start.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import VerifyForm from "./VerifyForm";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) {
    redirect("/signup");
  }

  return (
    <main className="font-system relative flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
      <header className="absolute inset-x-0 top-0">
        <nav className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <Link
            href="/signup"
            className="text-[17px] font-semibold tracking-[-0.02em] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
          >
            <span aria-hidden="true">‹</span> Back
          </Link>
        </nav>
      </header>

      <div className="animate-card-in w-full max-w-[430px]">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Check your email
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-[#111827]">{email}</span>. Enter it
            below to finish.
          </p>
        </header>

        <VerifyForm email={email} />
      </div>
    </main>
  );
}
