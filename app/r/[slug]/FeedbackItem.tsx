/**
 * One feedback submission as a clean, mobile-friendly card (Milestone 9; extracted to
 * its own file in M31 so both the dashboard and the new All-orders page render diner
 * feedback identically). Pure server component — no state, no client JS.
 */

import { formatInAppTz } from "@/lib/time";
import type { FeedbackRecord } from "@/lib/types";

/** Colour a rating so an owner can scan good / ok / bad at a glance. */
export function ratingTone(rating: number): string {
  if (rating >= 8) return "bg-green-50 text-green-700";
  if (rating >= 5) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default function FeedbackItem({ record }: { record: FeedbackRecord }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#E5E7EB] p-4">
      <div
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold ${ratingTone(
          record.rating
        )}`}
      >
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
            {formatInAppTz(record.timestamp)}
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
                className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {/* Win-back contact, if this diner left one (M24). */}
        {(record.contactName || record.contactPhone) && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-900">
            Contact:{" "}
            {[record.contactName, record.contactPhone].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
