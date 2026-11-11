/**
 * Shown instantly while Settings loads (see app/Skeleton.tsx). Mirrors the real
 * frame: on a phone the sticky ☰ bar, on a laptop the section menu down the left —
 * then the open section's card.
 */
import { Bone, SkeletonCard, SkeletonScreen } from "@/app/Skeleton";

export default function SettingsLoading() {
  return (
    <SkeletonScreen label="Loading settings">
      <div className="mx-auto w-full max-w-2xl px-5 py-8 lg:max-w-5xl">
        <header className="mb-6 flex flex-col gap-2.5">
          <Bone className="h-4 w-24 rounded-md" />
          <Bone className="h-7 w-32 rounded-lg" />
          <Bone className="h-4 w-72 max-w-full rounded-md" />
        </header>

        <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* Phone: the ☰ bar */}
          <div className="-mx-5 mb-5 flex items-center gap-3 border-b border-[#E2E8F0] px-5 py-3 lg:hidden">
            <Bone className="h-11 w-11 flex-none rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bone className="h-3 w-20 rounded-md" />
              <Bone className="h-4 w-32 rounded-md" />
            </div>
          </div>

          {/* Laptop: the section menu */}
          <div className="hidden flex-col gap-2 lg:flex">
            {["w-28", "w-32", "w-20", "w-32", "w-16", "w-16", "w-36", "w-28"].map((w, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Bone className="h-5 w-5 flex-none rounded-md" />
                <Bone className={`h-4 rounded-md ${w}`} />
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <SkeletonCard>
              <Bone className="h-5 w-40 rounded-md" />
              <Bone className="mt-5 h-4 w-32 rounded-md" />
              <Bone className="mt-2 h-12 w-full rounded-2xl" />
              <Bone className="mt-5 h-14 w-full rounded-xl" />
            </SkeletonCard>
            <Bone className="mt-6 h-12 w-40 rounded-2xl" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
