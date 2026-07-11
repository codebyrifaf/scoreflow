"use client";

/**
 * "Change password" button + modal for the owner dashboard (Milestone 12).
 *
 * Opens a native <dialog> with a small form (current / new / confirm). The server
 * action `changePassword` verifies the current password and updates it, scoped to
 * the logged-in owner. On success we show a brief confirmation.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import { changePassword, type ChangePasswordState } from "./actions";

const FIELD_CLASS =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

export default function ChangePassword() {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [done, setDone] = useState(false);
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined
  );

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      setDone(true);
    }
  }, [state]);

  function openModal() {
    setDone(false);
    ref.current?.showModal();
  }
  function closeModal() {
    ref.current?.close();
  }

  const error = state && "error" in state ? state.error : undefined;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
      >
        Change password
      </button>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#111827]">Change password</h2>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
            >
              ✕
            </button>
          </div>

          {done ? (
            /* Changing your password bumps `tokenVersion` (M17), which kills EVERY
               session for this account — including this browser's. That's the
               point: if someone had stolen your password, they're now out. So we
               say so plainly and hand them a real sign-out (which clears the now-
               dead cookie) rather than a "Done" that would just bounce them to
               /login on their next click. */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                ✓
              </div>
              <p className="text-[15px] text-[#374151]">
                Your password has been updated. For your security we signed you out
                everywhere — please sign in again with your new password.
              </p>
              <form action={logout} className="w-full">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
                >
                  Sign in again
                </button>
              </form>
            </div>
          ) : (
            <form ref={formRef} action={action} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-medium text-[#111827]"
                >
                  Current password
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium text-[#111827]"
                >
                  New password{" "}
                  <span className="font-normal text-[#9CA3AF]">
                    (at least 12 characters)
                  </span>
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-[#111827]"
                >
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={FIELD_CLASS}
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
                className="mt-1 w-full rounded-2xl bg-amber-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100"
              >
                {pending ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
