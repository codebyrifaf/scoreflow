"use client";

/**
 * Step 2 of self-serve signup (Milestone 20) — CLIENT component.
 * Enter the 6-digit code we emailed; on success the account is created and we go
 * to sign-in. Also offers a "resend" for when the email is slow.
 */

import { useActionState, useState, useTransition } from "react";
import { confirmSignup, resendSignupCode, type VerifyState } from "../actions";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-center text-2xl tracking-[0.4em] text-[#111827] outline-none transition duration-200 placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

export default function VerifyForm({ email }: { email: string }) {
  const boundConfirm = confirmSignup.bind(null, email);
  const [state, action, pending] = useActionState<VerifyState, FormData>(
    boundConfirm,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  const [resent, setResent] = useState(false);
  const [isResending, startResend] = useTransition();

  function resend() {
    startResend(async () => {
      await resendSignupCode(email);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        autoFocus
        className={FIELD}
      />

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Verifying…" : "Verify & start trial"}
      </button>

      <p className="text-center text-sm text-[#6B7280]">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={isResending}
          className="font-medium text-amber-600 hover:underline disabled:opacity-50"
        >
          {resent ? "Sent!" : isResending ? "Sending…" : "Resend code"}
        </button>
      </p>
    </form>
  );
}
