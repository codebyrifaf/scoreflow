/**
 * Dates in the RESTAURANT's day, not the server's (Milestone 24).
 *
 * ── The bug this fixes ───────────────────────────────────────────────────────
 * The dashboard worked out "Today" and the 7-day trend with `setHours(0,0,0,0)`,
 * which uses the SERVER's timezone. On Vercel the server is UTC. So for a UK
 * restaurant, "Today" began at 00:00 UTC — which in British Summer Time is 1am
 * local — and a diner who rated their meal at 12:30am local (23:30 UTC the day
 * before) was counted on the WRONG day. Every date-based figure was subtly off.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * We compute all day boundaries in a fixed business timezone. The product is sold
 * in the UK, so that's `Europe/London` — one constant, one place to change. (If we
 * ever sell outside the UK, this becomes a per-restaurant column; until then a
 * fixed zone is correct for every customer and far simpler.)
 *
 * Doing this correctly means surviving the BST↔GMT switch (the clocks change, so
 * "midnight London" is a different number of hours from UTC in summer vs winter).
 * `Intl.DateTimeFormat` with a `timeZone` knows the rules, so we lean on it rather
 * than doing fragile offset arithmetic by hand.
 */

/** The business timezone. UK-only for now — see the file header. */
export const APP_TIMEZONE = "Europe/London";

/**
 * The local calendar day of an instant, as "YYYY-MM-DD" in the app timezone.
 * This is the key we bucket feedback by — two instants share a day iff this
 * matches. `en-CA` formats as YYYY-MM-DD, which sorts correctly as a string.
 */
export function localDayKey(date: Date, tz: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The wall-clock parts of `date` in the app timezone, as numbers. */
function partsInTz(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // some engines say "24" at midnight — normalise to 0
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * How far `tz` is ahead of UTC at `date`, in ms (BST = +3,600,000; GMT = 0).
 *
 * Trick: read the wall-clock time in `tz`, treat those numbers AS IF they were UTC,
 * and subtract the real UTC instant. The difference is the offset. Uses only Intl,
 * so it knows the actual DST rules rather than assuming a fixed offset.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const realToSecond = Math.floor(date.getTime() / 1000) * 1000;
  return asIfUtc - realToSecond;
}

/**
 * The UTC instant of the START of `date`'s local day (local midnight) in `tz`.
 * Correct across DST.
 *
 * ── Why the earlier version was wrong ────────────────────────────────────────
 * It subtracted the wall-clock elapsed-since-midnight from `date`. On the two days
 * a year the clocks change, wall-clock hours ≠ real hours (a spring-forward day
 * has 23 real hours but the clock still reads 24), so it landed on the wrong
 * instant. This version INVERTS the timezone instead: it takes the local calendar
 * day, then asks "which UTC instant is midnight on that local day?" — which the
 * DST rules answer correctly.
 */
export function startOfLocalDay(date: Date, tz: string = APP_TIMEZONE): Date {
  const { year, month, day } = partsInTz(date, tz);
  // Local midnight as-if-UTC, then shift by the zone's offset at that moment.
  const midnightAsIfUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const off = tzOffsetMs(new Date(midnightAsIfUtc), tz);
  let candidate = midnightAsIfUtc - off;
  // On a DST edge the offset a moment before midnight can differ from the offset
  // at our first candidate; re-evaluate once at the candidate to be exact.
  const off2 = tzOffsetMs(new Date(candidate), tz);
  if (off2 !== off) candidate = midnightAsIfUtc - off2;
  return new Date(candidate);
}

/** The start of TODAY's local day (the "Today" filter cutoff). */
export function startOfTodayLocal(now: Date = new Date(), tz: string = APP_TIMEZONE): Date {
  return startOfLocalDay(now, tz);
}

/**
 * The last `count` local days, oldest → newest, each as { start, end, key, date }.
 * Drives the 7-day trend. `end` is exclusive (the next day's local midnight), so
 * bucketing is a simple `start <= t < end` — and it's DST-correct because each
 * boundary is a real local-midnight instant (a fall-back day is genuinely 25 hours
 * long here), not "24h × n" arithmetic.
 */
export function lastLocalDays(
  count: number,
  now: Date = new Date(),
  tz: string = APP_TIMEZONE
): { start: Date; end: Date; key: string; date: Date }[] {
  // Collect day-starts walking backwards from today. Stepping back 12h from a local
  // midnight lands safely in the previous local day whatever DST does (±1h), and
  // startOfLocalDay then snaps to that day's real midnight.
  const starts: Date[] = [];
  let dayStart = startOfLocalDay(now, tz);
  for (let i = 0; i < count; i++) {
    starts.push(dayStart);
    dayStart = startOfLocalDay(new Date(dayStart.getTime() - 12 * 3600 * 1000), tz);
  }
  starts.reverse(); // oldest first

  return starts.map((start, i) => {
    // Each day ends where the next begins; the last ends at the start of tomorrow.
    const end =
      i + 1 < starts.length
        ? starts[i + 1]
        : startOfLocalDay(new Date(start.getTime() + 36 * 3600 * 1000), tz);
    return { start, end, key: localDayKey(start, tz), date: start };
  });
}

/** A readable timestamp in the app timezone, e.g. "12 Jul, 21:03". */
export function formatInAppTz(iso: string, tz: string = APP_TIMEZONE): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** A short weekday label for a day, in the app timezone (e.g. "M", "T"). */
export function weekdayNarrow(date: Date, tz: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
  })
    .format(date)
    .slice(0, 2);
}
