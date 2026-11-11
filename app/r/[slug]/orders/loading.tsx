/** Shown instantly while "All orders" loads (see app/Skeleton.tsx): header, then the list. */
import { Bone, SkeletonHeader, SkeletonRows, SkeletonScreen } from "@/app/Skeleton";

export default function OrdersLoading() {
  return (
    <SkeletonScreen label="Loading orders">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <SkeletonHeader back titleWidth="w-40" action />
        <Bone className="mb-5 h-10 w-64 max-w-full rounded-full" />
        <SkeletonRows count={6} />
      </div>
    </SkeletonScreen>
  );
}
