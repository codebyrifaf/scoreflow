"use client";

import { useActionState } from "react";
import { operatorLogin, type OperatorLoginState } from "./actions";
import PasswordInput from "@/app/PasswordInput";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-[#111827] focus:ring-4 focus:ring-[#111827]/10";

export default function OperatorLoginForm() {
  const [state, action, pending] = useActionState<OperatorLoginState, FormData>(
    operatorLogin,
    undefined
  );

  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-[#111827]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-[#111827]">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#111827] px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
