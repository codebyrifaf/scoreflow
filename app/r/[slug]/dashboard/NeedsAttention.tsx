"use client";

/**
 * The "Needs attention" worklist (Milestone 18) — CLIENT component.
 *
 * This is the in-dashboard half of the alert system. A bell with a red dot is
 * decoration; a worklist is a product. It shows the diners who were genuinely
 * unhappy (rated at or below the restaurant's `alertThreshold`) and haven't been
 * dealt with yet, each with a "Mark resolved" button — so the owner can work
 * through them instead of just being pinged.
 *
 * It's also where the alert email points, and it's what gives you a number worth
 * selling: "you resolved 12 of 14 complaints this month".
 */

import { useActionState } from "react";
import { markResolved, type ResolveState } from "./actions";
import type { FeedbackRecord } from "@/lib/types";

/** One open complaint, with its resolve button. */
function ComplaintCard({
  slug,
  record,
  formatTimestamp,
}: {
  slug: string;
  record: FeedbackRecord;
  formatTimestamp: (iso: string) => string;
}) {
  // `.bind` pins the slug + row id on the SERVER side of the action, so the
  // browser never gets to name a different restaurant.
  const boundResolve = markResolved.bind(null, slug, record.id);
  const [state, action, pending] = useActionState<ResolveState, FormData>(
    boundResolve,
    undefined
  );
  const error = state && "error" in state ? state.error : undefined;

  return (
    <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-700">
        {record.rating}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[#111827]">
            Order {record.orderNumber}
            <span className="font-normal text-[#6B7280]">
              {" · "}Table {record.table ?? "—"}
            </span>
          </span>
          <span className="flex-none text-xs text-[#9CA3AF]">
            {formatTimestamp(record.timestamp)}
          </span>
        </div>

        {record.comment && (
          <p className="mt-1 text-sm text-[#374151]">{record.comment}</p>
        )}

        {record.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#374151]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* The win-back contact — the whole point of this worklist (M24). If the
            diner left a number, the owner can call them right now and turn a
            one-star into a regular. A tap-to-call link on mobile. */}
        {(record.contactName || record.contactPhone) && (
          <div className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-sm">
            <span className="font-medium text-[#111827]">
              {record.contactName || "Diner"} wants to hear from you:
            </span>{" "}
            {record.contactPhone ? (
              <a
                href={`tel:${record.contactPhone.replace(/\s+/g, "")}`}
                className="font-semibold text-amber-700 underline"
              >
                {record.contactPhone}
              </a>
            ) : (
              <span className="text-[#6B7280]">no number left</span>
            )}
          </div>
        )}

        <form action={action} className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
          >
            {pending ? "Saving…" : "Mark resolved"}
          </button>
          {error && (
            <span role="alert" className="text-sm font-medium text-red-600">
              {error}
            </span>
          )}
        </form>
      </div>
    </div>
  );
}

export default function NeedsAttention({
  slug,
  complaints,
  totalOpen,
  alertThreshold,
}: {
  slug: string;
  /** The first page of open complaints — capped, so a big backlog can't bloat the page. */
  complaints: FeedbackRecord[];
  /** How many are REALLY open. May exceed `complaints.length` (see lib/feedback). */
  totalOpen: number;
  alertThreshold: number;
}) {
  // Formatting lives here (not passed from the server) so the timestamp renders in
  // the OWNER's local timezone, not the server's UTC.
  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (complaints.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-[#111827]">
          Needs attention
        </h2>
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-6 text-center text-sm text-[#6B7280]">
          Nothing open. Diners who rate {alertThreshold} or below show up here so
          you can put things right.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[#111827]">Needs attention</h2>
        {/* The TRUE total, not the number of cards we render below. */}
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
          {totalOpen}
        </span>
      </div>
      <p className="mb-3 text-sm text-[#6B7280]">
        Unhappy diners ({alertThreshold} or below) nobody has dealt with yet.
      </p>

      <div className="flex flex-col gap-3">
        {complaints.map((c) => (
          <ComplaintCard
            key={c.id}
            slug={slug}
            record={c}
            formatTimestamp={formatTimestamp}
          />
        ))}
      </div>

      {/* Say so when there are more than we're showing — a silently truncated
          worklist would let complaints go missing, which is the one thing this
          feature exists to prevent. */}
      {totalOpen > complaints.length && (
        <p className="mt-3 text-center text-sm text-[#6B7280]">
          Showing the {complaints.length} most recent of {totalOpen} open.
          Resolve some to see the rest.
        </p>
      )}
    </section>
  );
}
