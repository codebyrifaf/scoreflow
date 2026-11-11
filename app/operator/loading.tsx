/**
 * Shown instantly while the operator overview loads (see app/Skeleton.tsx): header,
 * two rows of number cards, the signups chart.
 *
 * ⚠️ A loading.tsx also covers every page BELOW it, so /operator/login and
 * /operator/customers each have their own — otherwise they'd briefly show this
 * overview's shape.
 */
import { Bone, SkeletonCard, SkeletonHeader, SkeletonScreen, SkeletonStat } from "@/app/Skeleton";

const BARS = ["h-[20%]", "h-[35%]", "h-[15%]", "h-[50%]", "h-[30%]", "h-[65%]", "h-[45%]", "h-[25%]", "h-[55%]", "h-[40%]", "h-[70%]", "h-[35%]"];

export default function OperatorLoading() {
  return (
    <SkeletonScreen label="Loading the operator console" tinted>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <SkeletonHeader titleWidth="w-48" action />
        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
        </section>
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
        </section>
        <SkeletonCard>
          <Bone className="h-5 w-52 max-w-full rounded-md" />
          <div className="mt-4 flex h-24 gap-1">
            {BARS.map((h, i) => (
              <div key={i} className="flex flex-1 items-end">
                <Bone className={`w-full rounded-t-sm rounded-b-none ${h}`} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </SkeletonScreen>
  );
}
