"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { resetPassword, resendResetCode, type ResetState } from "./actions";
import CodeInput from "@/app/CodeInput";
import PasswordInput from "@/app/PasswordInput";

const FIELD =
  "w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-base text-[#0F172A] outline-none transition duration-200 placeholder:text-[#94A3B8] focus:border-aqua-600 focus:ring-4 focus:ring-aqua-500/25";
const LABEL = "text-sm font-medium text-[#0F172A]";

/** Seconds the "Resend" button stays disabled after landing / after a resend. */
const RESEND_COOLDOWN = 60;

export default function ResetForm({
  email,
  code,
}: {
  email: string;
  /** Pre-filled from an invite link (M36); the boxes stay editable. */
  code?: string;
}) {
  const bound = resetPassword.bind(null, email);
  const [state, action, pending] = useActionState<ResetState, FormData>(
    bound,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  // Resend + 60s cooldown — same as the signup screen, for consistency (M37).
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const canResend = cooldown <= 0 && !isResending;
  function resend() {
    if (!canResend) return;
    setResendError(null);
    startResend(async () => {
      // The cooldown restarts either way — a failed send shouldn't be hammered either.
      setCooldown(RESEND_COOLDOWN);
      try {
        const result = await resendResetCode(email);
        if ("error" in result) {
          // Never "Sent!" for an email that didn't go.
          setResendError(result.error);
          return;
        }
      } catch {
        setResendError("We couldn't send your reset email just now. Please try again in a few minutes.");
        return;
      }
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={`text-center ${LABEL}`}>Code from your email</label>
        <CodeInput name="code" defaultValue={code} autoFocus={!code} />
        <p className="text-center text-sm text-[#64748B]">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={!canResend}
            className="font-medium text-aqua-700 hover:underline disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:no-underline"
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
        {resendError && (
          <p role="alert" className="text-center text-sm font-medium text-red-600">
            {resendError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={LABEL}>
          New password{" "}
          <span className="font-normal text-[#94A3B8]">(at least 12 characters)</span>
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className={LABEL}>
          Confirm new password
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
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
        className="w-full rounded-2xl bg-brand px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
