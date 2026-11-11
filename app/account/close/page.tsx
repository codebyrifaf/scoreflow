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
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-white px-5 py-12 text-center text-[#0F172A]">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="max-w-sm text-[#64748B]">
        Only the account owner can close the account.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-deep"
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
    <main className="font-system min-h-dvh w-full bg-white text-[#0F172A]">
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <Link
          href={`/b/${access.brandSlug}`}
          className="text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
        >
          <span aria-hidden="true">‹</span> Back
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Close your account
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#64748B]">
          This permanently deletes <b className="text-[#0F172A]">{access.brandName}</b>{" "}
          and everything in it. It cannot be undone, and we cannot get it back for
          you.
        </p>

        <div className="mt-6 rounded-2xl border border-[#E2E8F0] p-5">
          <p className="text-sm font-semibold text-[#0F172A]">
            What gets deleted
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#334155]">
            <li>
              • <b className="text-[#0F172A]">{locations}</b>{" "}
              {locations === 1 ? "location" : "locations"}
            </li>
            <li>
              • <b className="text-[#0F172A]">{responses}</b> diner{" "}
              {responses === 1 ? "response" : "responses"} — every rating and comment
              you&apos;ve ever received
            </li>
            <li>
              • <b className="text-[#0F172A]">{managers}</b> manager{" "}
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

        <p className="mt-6 text-center text-sm text-[#64748B]">
          Changed your mind?{" "}
          <Link
            href={`/b/${access.brandSlug}`}
            className="font-medium text-aqua-700 hover:underline"
          >
            Keep my account
          </Link>
        </p>
      </div>
    </main>
  );
}
