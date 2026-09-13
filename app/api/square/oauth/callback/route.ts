/**
 * `GET /api/square/oauth/callback` — where Square sends the owner back.
 *
 * Success: `?code=…&state=…`. Owner clicked Deny: `?error=access_denied&state=…`.
 * Either way the owner lands back on Settings with a `?square=<outcome>` notice —
 * never on an error page and never somewhere silent (the M18 rule).
 *
 * Order of checks, and why:
 *   1. The state must match the cookie we set on the way out — otherwise this
 *      return trip isn't one we started (a forged link), and nothing happens.
 *   2. The visitor must STILL be this account's owner — re-checked against the
 *      database, not assumed from the trip out (the M17 rule).
 *   3. Only then is Square's one-time code swapped for tokens.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireDashboardAccess } from "@/lib/auth-guard";
import { getRestaurantBySlug } from "@/lib/restaurants";
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  completeSquareConnection,
  statesMatch,
} from "@/lib/square";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jar = await cookies();

  // Read the state cookie, then expire it at once: single use, whatever happens.
  // (Expired on its own path — a plain delete() wouldn't match a path-scoped cookie.)
  const stored = jar.get(OAUTH_STATE_COOKIE)?.value ?? "";
  jar.set(OAUTH_STATE_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });

  const dot = stored.indexOf(".");
  const expectedState = dot > 0 ? stored.slice(0, dot) : "";
  const slug = dot > 0 ? stored.slice(dot + 1) : "";

  // No cookie: expired, cleared, or a different browser. We don't even know which
  // restaurant this was for — send them home; /login forwards a signed-in owner on.
  if (!expectedState || !slug) redirect("/login");

  const settings = `/r/${encodeURIComponent(slug)}/settings`;
  if (!statesMatch(params.get("state") ?? "", expectedState)) {
    redirect(`${settings}?square=error`);
  }
  if (params.get("error")) {
    redirect(`${settings}?square=${params.get("error") === "access_denied" ? "denied" : "error"}`);
  }
  const code = params.get("code");
  if (!code) redirect(`${settings}?square=error`);

  const access = await requireDashboardAccess(slug);
  if (!access.authorized || !access.isAccountOwner) redirect(`${settings}?square=forbidden`);
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant?.brandId) redirect(`${settings}?square=error`);

  // `redirect` works by throwing, so it must stay OUTSIDE the try (Next's docs).
  let outcome: string;
  try {
    outcome = await completeSquareConnection(restaurant.brandId, code);
  } catch (err) {
    // Logged without detail that could contain a token (see SquareError).
    console.error("[square] connecting failed:", (err as Error).message);
    outcome = "error";
  }
  redirect(`${settings}?square=${outcome}`);
}
