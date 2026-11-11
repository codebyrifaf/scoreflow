/**
 * Loading skeletons — the soft grey-blue shapes a page shows while its data is on the
 * way, in the layout of the real page, with a gentle light sweeping across them.
 *
 * How they appear: every page that has to wait for the database has a `loading.tsx`
 * next to it. Next.js shows that file INSTANTLY when someone opens or moves to the
 * page, and swaps in the real page the moment it's ready — so nobody stares at a
 * blank white screen, and the content lands where its shapes already were.
 *
 * The shimmer itself is the `.skeleton` class in globals.css. The light band is
 * pinned to the screen, not to each shape, so ONE sweep passes over every shape
 * together (rather than each little bar flickering on its own).
 *
 * Plain components with no state: safe for the server, nothing to load.
 */

import type { ReactNode } from "react";

/** One placeholder shape. Size and corner rounding come from `className`. */
export function Bone({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/**
 * The whole loading screen. Announces "Loading…" to screen readers once (the shapes
 * themselves are hidden from them), and fills the screen like the real page does.
 */
export function SkeletonScreen({
  label,
  tinted = false,
  children,
}: {
  /** What a screen reader hears, e.g. "Loading your dashboard". */
  label: string;
  /** The operator console's pale-grey background, instead of white. */
  tinted?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      role="status"
      aria-busy="true"
      className={`font-system min-h-dvh w-full ${tinted ? "bg-[#F8FAFC]" : "bg-white"}`}
    >
      <span className="sr-only">{label}…</span>
      {children}
    </main>
  );
}

/** A white card with the app's usual border — skeleton contents go inside. */
export function SkeletonCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-[#E2E8F0] bg-white p-5 ${className}`}>{children}</div>
  );
}

/**
 * The top of an owner page: an optional "‹ back" link, the big title, the line
 * under it, and optionally a button on the right.
 */
export function SkeletonHeader({
  back = false,
  action = false,
  titleWidth = "w-56",
}: {
  back?: boolean;
  action?: boolean;
  titleWidth?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2.5">
        {back && <Bone className="mb-1 h-4 w-24 rounded-md" />}
        <Bone className={`h-7 max-w-full rounded-lg ${titleWidth}`} />
        <Bone className="h-4 w-44 max-w-full rounded-md" />
      </div>
      {action && <Bone className="h-10 w-28 rounded-xl" />}
    </header>
  );
}

/**
 * A list of feedback-style rows: a score square on the left, two lines of text.
 * Widths vary row to row so it reads as real content, not a stamped pattern.
 */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-3/5"];
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="flex items-start gap-3">
          <Bone className="h-10 w-10 flex-none rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <Bone className={`h-4 rounded-md ${widths[i % widths.length]}`} />
            <Bone className={`h-3.5 rounded-md ${widths[(i + 2) % widths.length]}`} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** A small "number" card: a label and a big figure (dashboard / operator stats). */
export function SkeletonStat({ className = "" }: { className?: string }) {
  return (
    <SkeletonCard className={className}>
      <Bone className="h-3.5 w-24 rounded-md" />
      <Bone className="mt-3 h-8 w-20 rounded-lg" />
    </SkeletonCard>
  );
}
