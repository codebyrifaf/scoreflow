/**
 * Shown instantly while the dashboard loads (see app/Skeleton.tsx). Same column,
 * same order as the real page: name + sign-out, the page buttons, the period tabs,
 * the number cards, the 7-day chart, then recent feedback.
 */
import { Bone, SkeletonCard, SkeletonRows, SkeletonScreen, SkeletonStat } from "@/app/Skeleton";

// Bar heights for the chart's shape — fixed, so it looks like a chart, not noise.
const BARS = ["h-[45%]", "h-[62%]", "h-[38%]", "h-[70%]", "h-[55%]", "h-[80%]", "h-[66%]"];

export default function DashboardLoading() {
  return (
    <SkeletonScreen label="Loading your dashboard">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2.5">
              <Bone className="h-7 w-60 max-w-full rounded-lg" />
              <Bone className="h-4 w-32 rounded-md" />
            </div>
            <Bone className="h-9 w-24 rounded-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["w-24", "w-28", "w-20", "w-32"].map((w) => (
              <Bone key={w} className={`h-9 rounded-full ${w}`} />
            ))}
          </div>
        </header>

        <Bone className="mb-6 h-10 w-64 max-w-full rounded-full" />

        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat className="col-span-2 sm:col-span-1" />
        </section>

        <SkeletonCard className="mb-4">
          <Bone className="h-4 w-48 rounded-md" />
          <div className="mt-4 flex h-24 gap-2">
            {BARS.map((h, i) => (
              <div key={i} className="flex flex-1 items-end">
                <Bone className={`w-full rounded-t-md rounded-b-none ${h}`} />
              </div>
            ))}
          </div>
        </SkeletonCard>

        <Bone className="mb-3 mt-8 h-5 w-40 rounded-md" />
        <SkeletonRows count={4} />
      </div>
    </SkeletonScreen>
  );
}
