"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type ForgotState } from "./actions";

const FIELD =
  "w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-base text-[#0F172A] outline-none transition duration-200 placeholder:text-[#94A3B8] focus:border-aqua-600 focus:ring-4 focus:ring-aqua-500/25";

export default function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    requestReset,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[#0F172A]">
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          // Kept after an error — React resets the form to its defaultValue.
          defaultValue={state?.email ?? ""}
          placeholder="you@restaurant.com"
          className={FIELD}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-brand px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
      >
        {pending ? "Sending…" : "Send reset code"}
      </button>

      <p className="text-center text-sm text-[#64748B]">
        <Link href="/login" className="font-medium text-aqua-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
