"use client";

/**
 * Step 1 of self-serve signup (Milestone 20) — CLIENT component.
 * Collects email + password + the BUSINESS name; the server action validates it,
 * emails a code, and moves to the verify screen.
 *
 * ⚠️ The name asked for here is the ACCOUNT's (the company), not a venue's. Signup
 * no longer creates a restaurant — the customer adds their location(s) straight
 * afterwards. The hint under the field says so, because a one-restaurant owner who
 * types their restaurant name and then lands on "add your first location" needs to
 * know that's the flow working, not a mistake they made.
 */

import { useActionState } from "react";
import Link from "next/link";
import { requestSignup, type SignupState } from "./actions";
import PasswordInput from "@/app/PasswordInput";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const LABEL = "text-sm font-medium text-[#111827]";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-600">{message}</p>
  ) : null;
}

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    requestSignup,
    undefined
  );
  const errors = state && "errors" in state ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="businessName" className={LABEL}>
          Your restaurant or business name
        </label>
        <input
          id="businessName"
          name="businessName"
          placeholder="e.g. Uncle Bobo's"
          className={FIELD}
        />
        <p className="text-sm text-[#6B7280]">
          You&apos;ll add your location next — one, or as many as you run.
        </p>
        <FieldError message={errors.businessName} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={LABEL}>
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@restaurant.com"
          className={FIELD}
        />
        <FieldError message={errors.email} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={LABEL}>
          Password{" "}
          <span className="font-normal text-[#9CA3AF]">(at least 12 characters)</span>
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          className={FIELD}
        />
        <FieldError message={errors.password} />
      </div>

      <FieldError message={errors.form} />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Sending code…" : "Create account"}
      </button>

      <p className="text-center text-sm text-[#6B7280]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-amber-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
