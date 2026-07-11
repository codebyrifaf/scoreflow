"use client";

import { useActionState, useState } from "react";
import { closeAccount, type CloseState } from "./actions";

export default function CloseAccountForm({
  brandName,
}: {
  brandName: string;
}) {
  const [state, action, pending] = useActionState<CloseState, FormData>(
    closeAccount,
    undefined
  );
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === brandName;
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="confirm" className="text-sm text-[#111827]">
        Type <span className="font-semibold">{brandName}</span> to confirm
      </label>
      <input
        id="confirm"
        name="confirm"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!matches || pending}
        className="mt-1 w-full rounded-2xl bg-red-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100"
      >
        {pending ? "Closing…" : "Permanently close my account"}
      </button>
    </form>
  );
}
