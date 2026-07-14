"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { resetPassword, resendResetCode, type ResetState } from "./actions";
import CodeInput from "@/app/CodeInput";
import PasswordInput from "@/app/PasswordInput";

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const LABEL = "text-sm font-medium text-[#111827]";

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
    startResend(async () => {
      await resendResetCode(email);
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResent(false), 4000);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={`text-center ${LABEL}`}>Code from your email</label>
        <CodeInput name="code" defaultValue={code} autoFocus={!code} />
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={LABEL}>
          New password{" "}
          <span className="font-normal text-[#9CA3AF]">(at least 12 characters)</span>
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
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
