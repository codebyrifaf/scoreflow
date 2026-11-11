"use client";

import { useActionState } from "react";
import { operatorLogin, type OperatorLoginState } from "./actions";
import PasswordInput from "@/app/PasswordInput";

const FIELD =
  "w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-base text-[#0F172A] outline-none transition duration-200 placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:ring-4 focus:ring-[#0F172A]/10";

export default function OperatorLoginForm() {
  const [state, action, pending] = useActionState<OperatorLoginState, FormData>(
    operatorLogin,
    undefined
  );

  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-[#0F172A]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          // Kept after a failed attempt — React resets the form to its defaultValue.
          defaultValue={state?.email ?? ""}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-[#0F172A]">
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
        className="w-full rounded-2xl bg-[#0F172A] px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
