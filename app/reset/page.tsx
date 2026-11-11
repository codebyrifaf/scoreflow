/**
 * "Forgot password" — step 2 (the code + new password), served at `/reset`
 * (Milestone 20). Public. Needs the email in the query (set by /forgot).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import ResetForm from "./ResetForm";

export default async function ResetPage({
  searchParams,
}: {
  // `code` is pre-filled from a branch-manager INVITE link (M36); absent for the
  // normal forgot-password flow, where the user types the code from their email.
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const { email, code } = await searchParams;
  if (!email) {
    redirect("/forgot");
  }

  return (
    <main className="font-system relative flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#0F172A]">
      <header className="absolute inset-x-0 top-0">
        <nav className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <Link
            href="/login"
            className="text-[17px] font-semibold tracking-[-0.02em] text-[#64748B] transition-colors hover:text-[#0F172A]"
          >
            <span aria-hidden="true">‹</span> Sign in
          </Link>
        </nav>
      </header>

      <div className="animate-card-in w-full max-w-[430px]">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
            Choose a new password
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#64748B]">
            We emailed a code to{" "}
            <span className="font-medium text-[#0F172A]">{email}</span> — if that
            address has an account.
          </p>
        </header>

        <ResetForm email={email} code={code} />
      </div>
    </main>
  );
}
