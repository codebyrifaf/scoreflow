/**
 * "Restaurant not found" page for the /r/[slug] routes.
 *
 * When a page under /r/[slug] calls `notFound()` (no restaurant has that slug),
 * Next.js renders THIS component with a real HTTP 404. Premium white theme, to
 * match the rest of the app (Milestone 12).
 */

import Link from "next/link";

export default function RestaurantNotFound() {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-5 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6] text-3xl">
        🔎
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
          Restaurant not found
        </h1>
        <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-[#6B7280]">
          We couldn&apos;t find a restaurant at this address. Please double-check
          the link — it may be mistyped or no longer active.
        </p>
      </div>
      <Link
        href="/"
        className="mt-1 rounded-2xl bg-amber-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
      >
        Go to home
      </Link>
    </main>
  );
}
