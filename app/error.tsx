"use client";

/**
 * The app-wide error boundary (Milestone 19 — safety net).
 *
 * Catches anything thrown while rendering a page that doesn't have a more
 * specific `error.tsx` of its own — the owner dashboard, the settings page, the
 * brand console, /admin, /login. Before this existed, all of them fell through to
 * Next.js's default *"Application error: a server-side exception has occurred"*
 * screen.
 *
 * This audience is a signed-in owner or operator, not a diner, so we can be a bit
 * more direct — but still: no stack trace, no digest string, and a way out.
 * (The diner-facing feedback page has its own, gentler boundary. See
 * app/r/[slug]/feedback/error.tsx and the note in it about why that one matters
 * most.)
 */

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The real error goes to the server logs, where we can act on it. (This single
    // line becomes `Sentry.captureException(error)` when monitoring is added.)
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6] text-3xl text-[#6B7280]">
        ⚠
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-[15px] leading-relaxed text-[#6B7280]">
        We hit an unexpected problem loading this page. Your data is safe — nothing
        was lost. Try again, and if it keeps happening let us know.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="rounded-2xl border border-[#E5E7EB] px-6 py-3 font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
