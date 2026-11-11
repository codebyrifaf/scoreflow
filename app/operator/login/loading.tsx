/**
 * The operator sign-in's own loading shape. Without it, the overview skeleton in
 * app/operator/loading.tsx (which covers every page under /operator) would flash
 * a dashboard on the sign-in page.
 */
import { Bone, SkeletonScreen } from "@/app/Skeleton";

export default function OperatorLoginLoading() {
  return (
    <SkeletonScreen label="Loading">
      <div className="flex min-h-dvh w-full flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <Bone className="h-3.5 w-24 rounded-md" />
          <Bone className="mt-2 h-7 w-48 rounded-lg" />
          <div className="mt-8 flex flex-col gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Bone className="h-4 w-20 rounded-md" />
                <Bone className="h-[54px] w-full rounded-2xl" />
              </div>
            ))}
            <Bone className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
