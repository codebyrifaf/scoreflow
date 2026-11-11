/** Shown instantly while the all-locations page loads (see app/Skeleton.tsx):
 *  header, then one card per location. */
import { Bone, SkeletonCard, SkeletonHeader, SkeletonScreen } from "@/app/Skeleton";

export default function BrandLoading() {
  return (
    <SkeletonScreen label="Loading your locations">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <SkeletonHeader titleWidth="w-52" action />
        <div className="flex flex-col gap-3">
          {["w-48", "w-40", "w-56"].map((w, i) => (
            <SkeletonCard key={i}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Bone className={`h-5 max-w-full rounded-md ${w}`} />
                  <Bone className="h-3.5 w-28 rounded-md" />
                </div>
                <Bone className="h-8 w-16 rounded-lg" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Bone className="h-9 w-24 rounded-xl" />
                <Bone className="h-9 w-24 rounded-xl" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
