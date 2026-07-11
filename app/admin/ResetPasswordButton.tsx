"use client";

/**
 * "Reset password" button + modal for an owner, on the admin card (Milestone 13).
 *
 * The operator sets a new password for a locked-out owner and passes it along;
 * the owner then changes it themselves. Self-contained (its own button + modal +
 * form) so each card can drop it in next to the owner email.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { resetOwnerPassword, type ResetState } from "./actions";

export default function ResetPasswordButton({
  ownerEmail,
}: {
  ownerEmail: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [done, setDone] = useState(false);
  const boundReset = resetOwnerPassword.bind(null, ownerEmail);
  const [state, action, pending] = useActionState<ResetState, FormData>(
    boundReset,
    undefined
  );

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      setDone(true);
    }
  }, [state]);

  function open() {
    setDone(false);
    ref.current?.showModal();
  }
  function close() {
    ref.current?.close();
  }

  const error = state && "error" in state ? state.error : undefined;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex-none text-xs font-medium text-amber-600 hover:underline"
      >
        Reset password
      </button>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#111827]">Reset password</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
            >
              ✕
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                ✓
              </div>
              <p className="text-[15px] text-[#374151]">
                Password reset for{" "}
                <span className="font-semibold">{ownerEmail}</span>. Share the new
                password with them — they can change it after logging in.
              </p>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-2xl bg-amber-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          ) : (
            <form ref={formRef} action={action} className="flex flex-col gap-4">
              <p className="text-sm text-[#6B7280]">
                Set a new password for{" "}
                <span className="font-medium text-[#111827]">{ownerEmail}</span>,
                then pass it along.
              </p>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`reset-${ownerEmail}`}
                  className="text-sm font-medium text-[#111827]"
                >
                  New password{" "}
                  <span className="font-normal text-[#9CA3AF]">
                    (at least 8 characters)
                  </span>
                </label>
                {/* type="text" so the operator can read it to pass it on. */}
                <input
                  id={`reset-${ownerEmail}`}
                  name="newPassword"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-2xl bg-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
                >
                  {pending ? "Resetting…" : "Reset password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
