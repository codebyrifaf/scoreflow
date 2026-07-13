/**
 * The time-range filter shared by the owner dashboard and the All-orders page
 * (Milestone 31). Kept in one place so the two screens can never disagree about what
 * "Week" means.
 */

import { startOfTodayLocal } from "./time";

export type Range = "all" | "today" | "week" | "month";

export const RANGES: Range[] = ["all", "today", "week", "month"];

export const RANGE_LABELS: Record<Range, string> = {
  all: "All",
  today: "Today",
  week: "Week",
  month: "Month",
};

/** Coerce an untrusted `?range=` value to a real Range (defaults to "all"). */
export function parseRange(raw: string | string[] | undefined): Range {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return RANGES.includes(value as Range) ? (value as Range) : "all";
}

/**
 * The earliest timestamp to include for a range (null = all time).
 *
 * ⚠️ "today" means the start of the current LOCAL (Europe/London) day, not the
 * server's UTC midnight (Milestone 24). On Vercel the server is UTC, so a naive
 * `setHours(0,0,0,0)` would put "today" an hour off in summer and drop late-evening
 * diners into the wrong day. "week"/"month" are rolling windows, so they're
 * timezone-independent.
 */
export function cutoffFor(range: Range, now: Date = new Date()): Date | null {
  if (range === "all") return null;
  if (range === "today") return startOfTodayLocal(now);
  const days = range === "week" ? 7 : 30; // rolling 7 / 30 days
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
