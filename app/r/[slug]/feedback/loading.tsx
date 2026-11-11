/**
 * Shown instantly while the GUEST page loads (see app/Skeleton.tsx) — what a diner
 * sees for the moment after scanning the QR, instead of a white screen: the logo,
 * the restaurant's name, then the form's shape (order number, the ten score tiles,
 * the comment box, the button). Same column and spacing as FeedbackForm, so the
 * real page lands exactly on top of it.
 */
import { Bone, SkeletonScreen } from "@/app/Skeleton";

export default function FeedbackLoading() {
  return (
    <SkeletonScreen label="Loading">
      <div className="flex w-full flex-col items-center px-5 py-10">
        <div className="w-full max-w-[430px]">
          <header className="mb-8 flex flex-col items-center gap-3">
            <Bone className="h-16 w-16 rounded-full" />
            <Bone className="h-7 w-52 max-w-full rounded-lg" />
          </header>

          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-2">
              <Bone className="h-4 w-36 rounded-md" />
              <Bone className="h-[54px] w-full rounded-2xl" />
            </div>

            <div className="flex flex-col gap-3">
              <Bone className="h-5 w-40 rounded-md" />
              <div className="grid grid-cols-5 gap-2.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <Bone key={i} className="aspect-square min-h-11 rounded-2xl" />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Bone className="h-4 w-32 rounded-md" />
              <Bone className="h-28 w-full rounded-2xl" />
            </div>

            <Bone className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
