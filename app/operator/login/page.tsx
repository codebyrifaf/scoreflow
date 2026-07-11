/**
 * The OPERATOR's sign-in page, served at `/operator/login` (Milestone 21).
 *
 * PUBLIC (it has to be — it's a login), but deliberately plain and unbranded: no
 * marketing, no "Get started", no link back to the customer site. It doesn't
 * advertise itself and nothing on the customer-facing pages links here.
 *
 * Visually it's the INVERSE of the customer login (near-black, not amber), so you
 * can never be confused about which side of the product you're signing in to.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import OperatorLoginForm from "./OperatorLoginForm";

export const metadata = {
  title: "ScoreFlow — Operator",
  robots: { index: false, follow: false }, // keep the console out of search results
};

export default async function OperatorLoginPage() {
  // Already signed in as an operator? Skip straight to the dashboard.
  const session = await auth();
  if (session?.user?.kind === "operator") {
    redirect("/operator");
  }

  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-[#111827]">
      <div className="animate-card-in w-full max-w-[400px]">
        <header className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
            Operator
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
            ScoreFlow console
          </h1>
        </header>

        <OperatorLoginForm />
      </div>
    </main>
  );
}
