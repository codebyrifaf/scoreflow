"use client";

/**
 * Step 2 of self-serve signup (Milestone 20; boxes + cooldown in M37) — CLIENT
 * component. Enter the 6-digit code we emailed; on success the account is created and
 * we go to sign-in. "Resend" is on a 60-second cooldown so nobody can hammer it (and
 * so we don't blast our email quota).
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { confirmSignup, resendSignupCode, type VerifyState } from "../actions";
import CodeInput from "@/app/CodeInput";

/** Seconds the "Resend" button stays disabled after landing / after a resend. */
const RESEND_COOLDOWN = 60;

export default function VerifyForm({ email }: { email: string }) {
  const boundConfirm = confirmSignup.bind(null, email);
  const [state, action, pending] = useActionState<VerifyState, FormData>(
    boundConfirm,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  const [resent, setResent] = useState(false);
  const [isResending, startResend] = useTransition();

  // Countdown: starts at 60 on mount, ticks to 0, resets to 60 on each resend.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const canResend = cooldown <= 0 && !isResending;

  function resend() {
    if (!canResend) return;
    startResend(async () => {
      await resendSignupCode(email);
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResent(false), 4000);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <CodeInput name="code" autoFocus />

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
          disabled={!canResend}
          className="font-medium text-amber-600 hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
        >
          {resent
            ? "Sent!"
            : isResending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
        </button>
      </p>
    </form>
  );
}
