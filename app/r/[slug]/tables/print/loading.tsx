/** Shown instantly while the printable QR sheet builds (see app/Skeleton.tsx): the
 *  toolbar, then a grid of QR-card shapes. Never printed — it's gone long before. */
import { Bone, SkeletonScreen } from "@/app/Skeleton";

export default function PrintLoading() {
  return (
    <SkeletonScreen label="Preparing your QR cards">
      <div className="border-b border-[#E2E8F0]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-col gap-2">
            <Bone className="h-5 w-40 rounded-md" />
            <Bone className="h-3.5 w-56 max-w-full rounded-md" />
          </div>
          <Bone className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] p-4 sm:p-6"
            >
              <Bone className="h-5 w-24 max-w-full rounded-md" />
              <Bone className="aspect-square w-full max-w-44 rounded-xl" />
              <Bone className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
