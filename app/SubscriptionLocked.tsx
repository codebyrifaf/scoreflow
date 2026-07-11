/**
 * The "your trial/subscription has lapsed" screen (Milestone 20).
 *
 * Shown by the private dashboards (owner, tables, settings, brand console) when the
 * account's subscription isn't live. It is a DEAD END on purpose — there's no
 * self-serve payment yet (that's a later milestone), so it tells the customer how
 * to get switched back on (pay the operator) and lets them sign out.
 *
 * ⚠️ This NEVER blocks the public `/r/<slug>/feedback` page. A lapsed bill is
 * between us and the restaurant; the diner at the table shouldn't be punished, and
 * the physical NFC chips must keep working. Only the private screens lock.
 */

import Link from "next/link";
import type { SubscriptionState } from "@/lib/subscriptions";
import { logout } from "@/app/login/actions";

export default function SubscriptionLocked({
  state,
}: {
  state: SubscriptionState;
}) {
  // `state.live` is false here by construction; narrow for the message.
  const canceled = !state.live && state.kind === "canceled";

  return (
    <main className="font-system flex min-h-dvh w-full flex-col items-center justify-center gap-5 bg-white px-5 py-12 text-center text-[#111827]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-600">
        ⏳
      </div>

      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">
          {canceled ? "Your account is paused" : "Your free trial has ended"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B7280]">
          {canceled
            ? "This account isn't active right now. Renew to get back into your dashboard."
            : "Thanks for trying ScoreFlow! To keep seeing your feedback and analytics, subscribe to continue."}
        </p>
      </div>

      {/* The manual-payment bridge (no online gateway yet). */}
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 text-left text-sm text-[#374151]">
        <p className="font-semibold text-[#111827]">To subscribe</p>
        <p className="mt-1">
          Get in touch with us and we&apos;ll set up your subscription and switch
          you back on — usually within a few hours. (Card payment is coming soon.)
        </p>
        <p className="mt-3 text-[#6B7280]">
          Your customers&apos; feedback form keeps working the whole time — nothing
          on your tables is affected.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <form action={logout}>
          <button
            type="submit"
            className="rounded-2xl border border-[#E5E7EB] px-6 py-3 font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* THE EXIT (M22). Every other private page is locked right now — so if this
          screen didn't offer a way out, a lapsed customer would be trapped: unable
          to use the product AND unable to leave or delete their data. `/account/close`
          is deliberately NOT subscription-gated for exactly this reason. (A branch
          manager who follows this link is refused there — it isn't their account to
          close.) */}
      <p className="mt-2 text-sm text-[#9CA3AF]">
        Don&apos;t want to continue?{" "}
        <Link href="/account/close" className="underline hover:text-[#6B7280]">
          Close your account and delete your data
        </Link>
      </p>
    </main>
  );
}
