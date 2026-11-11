/** Shown instantly while the operator's customer list loads (see app/Skeleton.tsx). */
import { Bone, SkeletonCard, SkeletonHeader, SkeletonScreen } from "@/app/Skeleton";

export default function CustomersLoading() {
  return (
    <SkeletonScreen label="Loading customers" tinted>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <SkeletonHeader back titleWidth="w-40" />
        <Bone className="mb-4 h-11 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {["w-44", "w-36", "w-52", "w-40", "w-48"].map((w, i) => (
            <SkeletonCard key={i} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <Bone className={`h-5 max-w-full rounded-md ${w}`} />
                <Bone className="h-3.5 w-56 max-w-full rounded-md" />
              </div>
              <Bone className="h-7 w-24 rounded-full" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
