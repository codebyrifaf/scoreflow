/**
 * Shared TypeScript types for the feedback loop.
 *
 * Keeping these in one place means the client form, the API route, and the
 * dashboard all agree on the exact shape of the data.
 *
 * (Milestone 4 moved this file here from app/feedback/types.ts and dropped the
 *  old `restaurant` string field — a feedback row's restaurant is now the
 *  database relation, not text carried on every record.)
 */

/**
 * What the browser sends to the API when a customer submits the form.
 *
 * Note: this does NOT include the restaurant. The server resolves the
 * restaurant from the URL slug (against the database) so the client can't claim
 * to be a different restaurant. See lib/restaurants.ts and the API route.
 */
export interface FeedbackPayload {
  /** Table number read from the URL (e.g. "7"). `null` if none was provided. */
  table: string | null;
  /** The customer's order number, typed into the form. */
  orderNumber: string;
  /** Rating from 1 to 10. */
  rating: number;
  /** Optional free-text comment (empty string if the customer left it blank). */
  comment: string;
  /**
   * Quick-tap suggestion chips the customer selected (Milestone 9), e.g.
   * ["Slow service", "Food was cold"]. Empty array if they picked none.
   */
  tags: string[];
  /**
   * OPTIONAL win-back contact (Milestone 24). A diner — usually an unhappy one —
   * can leave a name + phone so the restaurant can reach out and make it right.
   * Empty string when not given. This is personal data; handled with care.
   */
  contactName: string;
  contactPhone: string;
}

/**
 * One feedback submission as the dashboard consumes it.
 *
 * Milestone 18 added `id` and `resolvedAt`. The id used to be deliberately dropped
 * ("the dashboard doesn't need it") — but that meant NO per-row action was
 * possible at all: you can't mark a complaint resolved, or link an alert email to
 * one diner, without being able to name the row. It also forced the React lists to
 * key on `${timestamp}-${index}`, which is positionally unstable.
 *
 * `restaurantId` is still deliberately absent: pages already know which restaurant
 * they're rendering, and leaving it out means a record can't accidentally be used
 * to reach across tenants.
 */
export interface FeedbackRecord extends FeedbackPayload {
  /** Database id — needed to act on this one row (e.g. "mark resolved"). */
  id: number;
  /** ISO 8601 timestamp of when the feedback was received. */
  timestamp: string;
  /**
   * When someone dealt with this complaint (Milestone 18), or `null` if it's still
   * open. Only meaningful for ratings at/below the restaurant's `alertThreshold`.
   */
  resolvedAt: string | null;
}

/** A day in the 7-day trend: its label and the average rating that day (Milestone 24). */
export interface TrendDay {
  label: string;
  avg: number | null;
  count: number;
}

/** The window's headline numbers, computed in SQL not in memory (Milestone 24). */
export interface FeedbackStats {
  total: number;
  average: number | null;
}

/** Review-invite conversion for proving ROI (Milestone 24). */
export interface ReviewInviteStats {
  /** Diners shown the Google invite (i.e. submissions while a review URL was set). */
  invited: number;
  /** Of those, how many tapped through to Google. */
  clicked: number;
}
