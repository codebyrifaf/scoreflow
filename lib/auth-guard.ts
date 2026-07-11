/**
 * The dashboard access guard — the security core of Milestone 5.
 *
 * This is the "Data Access Layer" check that the Next.js docs recommend: the
 * authorization decision lives right next to the data, on the server, so it runs
 * on every request and can't be skipped by the browser.
 *
 * The rule it enforces for `/r/[slug]/dashboard`:
 *   1. You must be logged in           → otherwise redirect to /login.
 *   2. You may ONLY view the dashboard  → if the URL's `slug` isn't the
 *      of the restaurant you own          restaurant you own, access is denied.
 *
 * Because the owner's own restaurant slug comes from the signed session (set on
 * the server at login), a logged-in owner can never view another restaurant's
 * dashboard by editing the URL.
 */

import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * The result of an access check. It's a "discriminated union": when
 * `authorized` is true you also get the owner's details; when it's false you
 * get the slug of the restaurant they DO own (so the page can offer a link
 * back to their real dashboard).
 */
export type DashboardAccess =
  | { authorized: true; ownerEmail: string; restaurantSlug: string }
  | { authorized: false; ownerRestaurantSlug: string };

/**
 * Check whether the current visitor may view the dashboard for `slug`.
 *
 * - Not logged in → this REDIRECTS to /login and never returns (redirect()
 *   throws internally, so no code after the call runs).
 * - Logged in but wrong restaurant → returns `{ authorized: false, ... }`; the
 *   caller renders a clean "not authorized" screen. Crucially, we return BEFORE
 *   any of that restaurant's data is loaded, so nothing leaks.
 * - Logged in and it's their restaurant → returns `{ authorized: true, ... }`.
 */
export async function requireDashboardAccess(
  slug: string
): Promise<DashboardAccess> {
  const session = await auth();

  // 1. Must be signed in as an owner. If `restaurantSlug` is missing there's no
  //    valid owner session, so we treat it the same as "not logged in".
  if (!session?.user?.restaurantSlug) {
    redirect("/login");
  }

  // After the redirect above, TypeScript knows this is a real string.
  const ownerSlug = session.user.restaurantSlug;

  // 2. Ownership check: the restaurant in the URL must be the one they own.
  if (ownerSlug !== slug) {
    return { authorized: false, ownerRestaurantSlug: ownerSlug };
  }

  // 3. Authorized.
  return {
    authorized: true,
    ownerEmail: session.user.email ?? "",
    restaurantSlug: ownerSlug,
  };
}

/**
 * The result of the operator (admin) access check — same discriminated-union
 * shape as DashboardAccess. When not authorized we pass back the visitor's own
 * restaurant slug (if they happen to be a restaurant owner), so /admin can offer
 * them a link back to their own dashboard.
 */
export type OperatorAccess =
  | { authorized: true; operatorEmail: string }
  | { authorized: false; ownerRestaurantSlug: string | null };

/**
 * Check whether the current visitor may use the operator admin area (`/admin`).
 *
 * - Not logged in → REDIRECTS to /login (never returns).
 * - Logged in but NOT an operator (e.g. a restaurant owner) → returns
 *   `{ authorized: false, ... }`; the caller renders a clean "not authorized"
 *   screen. We return BEFORE loading any admin data, so nothing leaks.
 * - Logged in as an operator → returns `{ authorized: true, operatorEmail }`.
 */
export async function requireOperator(): Promise<OperatorAccess> {
  const session = await auth();

  // Must be signed in at all.
  if (!session?.user) {
    redirect("/login");
  }

  // Must specifically be an operator. A logged-in owner is NOT an operator.
  if (session.user.role !== "operator") {
    return {
      authorized: false,
      ownerRestaurantSlug: session.user.restaurantSlug ?? null,
    };
  }

  return { authorized: true, operatorEmail: session.user.email ?? "" };
}
