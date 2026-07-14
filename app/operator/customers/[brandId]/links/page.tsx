/**
 * Operator review-link oversight — `/operator/customers/[brandId]/links` (M39).
 *
 * The operator can SEE every review link a customer's brand + branches have set, and
 * switch a bad one OFF (a valid-but-wrong platform page). Disabling keeps the URL but
 * hides that tile from diners; the owner sees it flagged in their Settings.
 *
 * Boundary: review links are the restaurant's OWN PUBLIC page URLs (config) — NOT
 * diner feedback — so this doesn't breach "the operator never sees content".
 * Guarded by `requireOperator`.
 */

import Link from "next/link";
import { requireOperator } from "@/lib/auth-guard";
import { getBrandReviewLinks } from "@/lib/operator-stats";
import { isValidReviewUrl } from "@/lib/review-url";
import {
  blockReviewLinkAction,
  unblockReviewLinkAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

const PILL =
  "rounded-full border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-[#6B7280]">This area is for ScoreFlow operators only.</p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600"
      >
        Go back
      </Link>
    </main>
  );
}

export default async function BrandReviewLinksPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const access = await requireOperator();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  const { brandId: brandIdRaw } = await params;
  const brandId = Number(brandIdRaw);
  const data = Number.isInteger(brandId)
    ? await getBrandReviewLinks(brandId)
    : null;

  return (
    <main className="font-system min-h-dvh w-full bg-[#FAFAFA] text-[#111827]">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              Operator
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {data ? `${data.brandName} — review links` : "Review links"}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Open a link to check it goes to the right page. Turn off a wrong one —
              it stops showing to diners, and the owner is told in their Settings.
            </p>
          </div>
          <Link href="/operator/customers" className={PILL}>
            ← Customers
          </Link>
        </header>

        {!data ? (
          <p className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
            That account no longer exists.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.branches.map((branch) => (
              <section
                key={branch.restaurantId}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5"
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-[#111827]">
                    {branch.branchName}
                  </h2>
                  <span className="font-mono text-xs text-[#9CA3AF]">
                    {branch.slug}
                  </span>
                </div>

                {branch.links.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF]">No review links set.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {branch.links.map((link) => {
                      const openable = isValidReviewUrl(link.platform, link.url);
                      return (
                        <li
                          key={link.platform}
                          className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3 first:border-0 first:pt-0"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                              {link.name}
                              {link.blocked && (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 max-w-md break-all text-xs text-[#6B7280]">
                              {link.url}
                            </div>
                          </div>

                          <div className="flex flex-none items-center gap-2">
                            {openable && (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-amber-600 hover:underline"
                              >
                                Open ↗
                              </a>
                            )}
                            {link.blocked ? (
                              <form
                                action={unblockReviewLinkAction.bind(
                                  null,
                                  branch.restaurantId,
                                  link.platform
                                )}
                              >
                                <button
                                  type="submit"
                                  className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
                                >
                                  Enable
                                </button>
                              </form>
                            ) : (
                              <form
                                action={blockReviewLinkAction.bind(
                                  null,
                                  branch.restaurantId,
                                  link.platform
                                )}
                                className="flex items-center gap-2"
                              >
                                <input
                                  name="reason"
                                  placeholder="Reason (optional)"
                                  className="w-40 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs outline-none focus:border-red-400"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                >
                                  Disable
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
