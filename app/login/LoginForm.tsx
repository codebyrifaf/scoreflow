"use client";

/**
 * The owner login form (CLIENT component).
 *
 * It's a client component because it uses `useActionState` to show a pending
 * state while submitting and to display an error returned by the server action.
 * The actual credential check happens on the server in `login` (actions.ts) —
 * this component only collects the email + password and shows the result.
 */

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";

// Style tokens shared with the customer feedback page, so the two feel like one
// product (rounded fields, soft brand focus ring, brand-accent button).
const FIELD_CLASS =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const PRIMARY_BTN_CLASS =
  "w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100";

export default function LoginForm({
  defaultEmail = "",
}: {
  defaultEmail?: string;
}) {
  // `useActionState` wires the form to our server action:
  //   state   → whatever `login` returned last (an error, or undefined)
  //   action  → what we hand to <form action={...}>
  //   pending → true while the submission is in flight
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );

  return (
    <form action={action} className="flex w-full flex-col gap-6">
      {/* Email --------------------------------------------------------------- */}
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
          defaultValue={defaultEmail}
          placeholder="owner@example.test"
          className={FIELD_CLASS}
        />
      </div>

      {/* Password ------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-medium text-[#111827]">
            Password
          </label>
          <Link
            href="/forgot"
            className="text-sm font-medium text-amber-600 hover:underline"
          >
            Forgot?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className={FIELD_CLASS}
        />
      </div>

      {/* Error message (shown on bad credentials) ---------------------------- */}
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}

      {/* Submit -------------------------------------------------------------- */}
      <button type="submit" disabled={pending} className={PRIMARY_BTN_CLASS}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
