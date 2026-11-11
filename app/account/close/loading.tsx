/** Shown instantly while the close-account page loads (see app/Skeleton.tsx). */
import { Bone, SkeletonScreen } from "@/app/Skeleton";

export default function CloseAccountLoading() {
  return (
    <SkeletonScreen label="Loading">
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <Bone className="h-4 w-24 rounded-md" />
        <Bone className="mt-4 h-7 w-56 max-w-full rounded-lg" />
        <Bone className="mt-4 h-4 w-full rounded-md" />
        <Bone className="mt-2 h-4 w-4/5 rounded-md" />
        <Bone className="mt-8 h-4 w-40 rounded-md" />
        <Bone className="mt-2 h-12 w-full rounded-2xl" />
        <Bone className="mt-6 h-12 w-44 rounded-2xl" />
      </div>
    </SkeletonScreen>
  );
}
