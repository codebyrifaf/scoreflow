/**
 * "Close my account" — served at `/account/close` (Milestone 22).
 *
 * The customer's exit door. Deliberately NOT subscription-gated: a lapsed customer
 * must still be able to leave, or they'd be trapped — locked out of the product and
 * unable to get rid of their data.
 *
 * Only the ACCOUNT OWNER can open it; a branch manager gets "Not authorized".
 */

import Link from "next/link";
import { requireAccountOwner } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import CloseAccountForm from "./CloseAccountForm";

export const dynamic = "force-dynamic";

function NotAuthorized({ homeHref }: { homeHref: string }) {
  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#111827]">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="max-w-sm text-[#6B7280]">
        Only the account owner can close the account.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600"
      >
        Go back
      </Link>
    </main>
  );
}

export default async function CloseAccountPage() {
  const access = await requireAccountOwner();
  if (!access.authorized) {
    return <NotAuthorized homeHref={access.homeHref} />;
  }

  // Spell out exactly what will be destroyed — nobody should be surprised.
  const [locations, responses, managers] = await Promise.all([
    prisma.restaurant.count({ where: { brandId: access.brandId } }),
    prisma.feedback.count({
      where: { restaurant: { brandId: access.brandId } },
    }),
    prisma.owner.count({
      where: { restaurant: { brandId: access.brandId } },
    }),
  ]);

  return (
    <main className="font-system min-h-dvh w-full bg-white text-[#111827]">
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <Link
          href={`/b/${access.brandSlug}`}
          className="text-sm font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
        >
          <span aria-hidden="true">‹</span> Back
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Close your account
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
          This permanently deletes <b className="text-[#111827]">{access.brandName}</b>{" "}
          and everything in it. It cannot be undone, and we cannot get it back for
          you.
        </p>

        <div className="mt-6 rounded-2xl border border-[#E5E7EB] p-5">
          <p className="text-sm font-semibold text-[#111827]">
            What gets deleted
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#374151]">
            <li>
              • <b className="text-[#111827]">{locations}</b>{" "}
              {locations === 1 ? "location" : "locations"}
            </li>
            <li>
              • <b className="text-[#111827]">{responses}</b> diner{" "}
              {responses === 1 ? "response" : "responses"} — every rating and comment
              you&apos;ve ever received
            </li>
            <li>
              • <b className="text-[#111827]">{managers}</b> manager{" "}
              {managers === 1 ? "login" : "logins"}, your tables, and your own login
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Your NFC chips will stop working. This cannot be undone.
          </p>
        </div>

        <div className="mt-6">
          <CloseAccountForm brandName={access.brandName} />
        </div>

        <p className="mt-6 text-center text-sm text-[#6B7280]">
          Changed your mind?{" "}
          <Link
            href={`/b/${access.brandSlug}`}
            className="font-medium text-amber-600 hover:underline"
          >
            Keep my account
          </Link>
        </p>
      </div>
    </main>
  );
}
