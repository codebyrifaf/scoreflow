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
}

/**
 * One feedback submission as the dashboard consumes it: the customer's input
 * plus the time it was recorded. (The database also stores an `id` and
 * `restaurantId`, but the dashboard doesn't need those, so they're not here.)
 */
export interface FeedbackRecord extends FeedbackPayload {
  /** ISO 8601 timestamp of when the feedback was received. */
  timestamp: string;
}
