/**
 * The site-wide 404 (Milestone 19 — safety net).
 *
 * There was already a 404 for an unknown restaurant slug
 * (`app/r/[slug]/not-found.tsx`), but any OTHER bad URL — a typo, a stale link, a
 * bot probing for /wp-admin — fell through to Next.js's unstyled default page.
 * This gives every wrong turn the same on-brand landing.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#0F172A]">
      <p className="text-sm font-semibold tracking-[0.2em] text-[#94A3B8]">404</p>

      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-[15px] leading-relaxed text-[#64748B]">
        The page you&apos;re looking for doesn&apos;t exist, or the link is out of
        date.
      </p>

      <Link
        href="/"
        className="mt-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep"
      >
        Go home
      </Link>
    </main>
  );
}
