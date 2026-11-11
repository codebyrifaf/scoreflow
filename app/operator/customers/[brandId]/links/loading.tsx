/** Shown instantly while a customer's review links load (see app/Skeleton.tsx):
 *  one card per location, a row per review platform. */
import { Bone, SkeletonCard, SkeletonHeader, SkeletonScreen } from "@/app/Skeleton";

export default function LinksLoading() {
  return (
    <SkeletonScreen label="Loading review links" tinted>
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <SkeletonHeader back titleWidth="w-56" />
        <div className="flex flex-col gap-4">
          {[0, 1].map((card) => (
            <SkeletonCard key={card}>
              <Bone className="h-5 w-44 rounded-md" />
              <div className="mt-4 flex flex-col gap-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3 first:border-0 first:pt-0">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Bone className="h-4 w-24 rounded-md" />
                      <Bone className="h-3.5 w-56 max-w-full rounded-md" />
                    </div>
                    <Bone className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
