"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type ForgotState } from "./actions";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

export default function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    requestReset,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[#111827]">
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
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Sending…" : "Send reset code"}
      </button>

      <p className="text-center text-sm text-[#6B7280]">
        <Link href="/login" className="font-medium text-amber-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
