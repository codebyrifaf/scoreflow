/** Shown instantly while "Tables & QR" loads (see app/Skeleton.tsx): header, the
 *  add-a-table box, then the list of tables. */
import { Bone, SkeletonCard, SkeletonHeader, SkeletonScreen } from "@/app/Skeleton";

export default function TablesLoading() {
  return (
    <SkeletonScreen label="Loading your tables">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <SkeletonHeader back titleWidth="w-44" action />
        <SkeletonCard className="mb-6">
          <Bone className="h-5 w-36 rounded-md" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Bone className="h-12 min-w-0 flex-1 rounded-2xl" />
            <Bone className="h-12 w-28 rounded-2xl" />
          </div>
        </SkeletonCard>
        <div className="flex flex-col gap-3">
          {["w-24", "w-20", "w-32", "w-28"].map((w, i) => (
            <SkeletonCard key={i} className="flex items-center justify-between gap-3">
              <Bone className={`h-5 rounded-md ${w}`} />
              <Bone className="h-9 w-24 rounded-xl" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
