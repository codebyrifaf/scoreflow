"use client";

/**
 * Error boundary for the CUSTOMER feedback page — the most important one in the
 * whole app.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * Without it, any thrown error here (the database asleep, Neon over quota, a bad
 * deploy) renders Next.js's default production error page: a bare white screen
 * reading *"Application error: a server-side exception has occurred (Digest:
 * 1234567890)"*.
 *
 * Think about WHO reads that. It's a diner, sitting at a table, who just tapped an
 * NFC chip in a restaurant that is PAYING US. They see a crash and a hex string.
 * They think the restaurant is broken. That is the single worst place in the
 * product for a raw error to surface, and it was completely unhandled.
 *
 * So: no stack, no digest, no jargon. A calm, on-brand message, a Try again
 * button (React re-renders the segment via `reset`), and a graceful way out. The
 * error still reaches the server logs — the diner just doesn't have to read it.
 *
 * Error boundaries MUST be client components — that's a Next.js requirement, not a
 * choice.
 */

import { useEffect } from "react";

export default function FeedbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the real error for US, on the server logs. (When Sentry is added later,
    // this is the one line that changes.)
    console.error("[feedback page] crashed:", error);
  }, [error]);

  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-10 text-center text-[#111827]">
      <div className="animate-card-in w-full max-w-[430px]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6] text-3xl text-[#6B7280]">
          ⚠
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
          We couldn&apos;t load the form
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
          Something went wrong on our side — nothing to do with your meal. Please
          try again in a moment, and do tell a member of staff if it keeps
          happening.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-8 w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
