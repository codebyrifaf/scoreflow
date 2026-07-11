"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "./actions";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const LABEL = "text-sm font-medium text-[#111827]";

export default function ResetForm({ email }: { email: string }) {
  const bound = resetPassword.bind(null, email);
  const [state, action, pending] = useActionState<ResetState, FormData>(
    bound,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className={LABEL}>
          Code from your email
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={LABEL}>
          New password{" "}
          <span className="font-normal text-[#9CA3AF]">(at least 12 characters)</span>
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className={LABEL}>
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={FIELD}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
