/**
 * `GET /api/square/oauth/start?slug=<branch>` — the "Connect Square" button.
 *
 * Checks the visitor is the ACCOUNT OWNER (Square connects the whole business, so a
 * branch manager can't make that call — the same rule as the menu and the logo),
 * mints a single-use `state`, and sends them to Square's own approval page.
 * Square sends them back to ../callback.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireDashboardAccess } from "@/lib/auth-guard";
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  newOAuthState,
  squareAuthorizeUrl,
  squareIsConfigured,
} from "@/lib/square";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  const settings = `/r/${encodeURIComponent(slug)}/settings`;

  // Signed out → /login (the guard redirects). Not this account's owner → back to
  // Settings, which explains. Checked BEFORE anything is created.
  const access = await requireDashboardAccess(slug);
  if (!access.authorized || !access.isAccountOwner) redirect(`${settings}?square=forbidden`);
  if (!squareIsConfigured()) redirect(`${settings}?square=not-configured`);

  // The state travels two ways — in Square's URL, and in this cookie — and the
  // callback only proceeds if they match. That's what stops a forged "come back
  // from Square" link from connecting someone else's business to this account.
  // httpOnly: page scripts can't read it. lax: it IS sent when Square redirects the
  // browser back (a top-level GET). 10 minutes: long enough to sign in to Square.
  const state = newOAuthState();
  (await cookies()).set(OAUTH_STATE_COOKIE, `${state}.${slug}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });

  redirect(squareAuthorizeUrl(state));
}
