/**
 * Square — "Connect Square" (Square integration, step 1).
 *
 * The owner clicks Connect Square, signs in on Square's own page, approves, and is
 * sent back here. We swap the one-time code for tokens, store them ENCRYPTED, and
 * link the business's locations to this account's branches. The owner never sees a
 * key or a URL. (Receiving orders is step 2, via webhooks; matching is step 3.)
 *
 * ── The rules this file keeps ────────────────────────────────────────────────
 *   • Tokens are encrypted at rest (lib/token-crypto.ts) and decrypted only at the
 *     moment of a request to Square. They are never logged, never returned to the
 *     browser, and never included in an error message.
 *   • Least privilege: read orders, read the business profile (for locations), and
 *     read the menu (for a future one-click menu import — asked for NOW so owners
 *     never have to reconnect to grant it later). Nothing that writes, nothing that
 *     touches money.
 *   • One Square business ↔ one ScoreFlow account (`merchantId` is unique), so a
 *     business's orders can never be delivered into somebody else's dashboard.
 *
 * Details verified against Square's docs (Sept 2026): authorize at
 * /oauth2/authorize, tokens from /oauth2/token, revoke at /oauth2/revoke with an
 * `Authorization: Client <secret>` header; access tokens last 30 days; code-flow
 * refresh tokens don't expire; Square recommends refreshing every 7 days or less.
 */

import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { appUrl } from "./app-url";
import { decryptToken, encryptToken, tokenCryptoConfigured } from "./token-crypto";

/** What the owner is asked to approve. See the header for why each is here. */
export const SQUARE_SCOPES = ["ORDERS_READ", "MERCHANT_PROFILE_READ", "ITEMS_READ"] as const;

/** Refresh once a token is a week old (30-day tokens → refresh with 23 days left). */
const REFRESH_WHEN_REMAINING_MS = 23 * 24 * 60 * 60 * 1000;

/** The short-lived cookie that carries the anti-forgery `state` across the trip. */
export const OAUTH_STATE_COOKIE = "sq_oauth_state";
export const OAUTH_COOKIE_PATH = "/api/square/oauth";

// ── Configuration ────────────────────────────────────────────────────────────

type SquareEnvironment = "sandbox" | "production";

export function squareEnvironment(): SquareEnvironment {
  return process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function squareBase(): string {
  return squareEnvironment() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

/** Everything "Connect Square" needs is in place. Settings shows a message rather
 *  than a button that can only fail when it isn't (the M18 rule). */
export function squareIsConfigured(): boolean {
  return (
    !!process.env.SQUARE_APPLICATION_ID &&
    !!process.env.SQUARE_APPLICATION_SECRET &&
    tokenCryptoConfigured()
  );
}

/** Can this server check Square's webhook signatures (step 2)? Without the key,
 *  every order Square sends is refused — so Settings says order sync is off rather
 *  than showing a connection that silently receives nothing (the M18 rule). */
export function squareWebhooksConfigured(): boolean {
  return !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
}

/** Must match, character for character, the Redirect URL registered in Square's
 *  Developer Console — locally `http://localhost:3000/api/square/oauth/callback`. */
export function squareRedirectUri(): string {
  return `${appUrl()}/api/square/oauth/callback`;
}

// ── The trip to Square and back ──────────────────────────────────────────────

/** A random, single-use value that proves the owner's return trip is the one we
 *  started — the standard defence against someone forging a callback. */
export function newOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function statesMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Square's approval page for this app, with our permissions and state. */
export function squareAuthorizeUrl(state: string): string {
  const url = new URL(`${squareBase()}/oauth2/authorize`);
  url.searchParams.set("client_id", process.env.SQUARE_APPLICATION_ID ?? "");
  url.searchParams.set("scope", SQUARE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Sent explicitly so a mismatch with the registered URL fails loudly at Square
  // rather than returning the owner somewhere unexpected. (`session=false` is
  // deliberately absent: Square's Sandbox doesn't support it.)
  url.searchParams.set("redirect_uri", squareRedirectUri());
  return url.toString();
}

// ── Tokens ───────────────────────────────────────────────────────────────────

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  merchant_id: string;
};

/** A Square failure, carrying only what's safe to log — never a token. */
class SquareError extends Error {
  constructor(what: string, status: number, body: unknown) {
    const errors = (body as { errors?: { code?: string; category?: string }[] })?.errors;
    const code = errors?.map((e) => e.code ?? e.category).join(",") ??
      (body as { type?: string; message?: string })?.type ?? "unknown";
    super(`[square] ${what} failed: HTTP ${status} (${code})`);
  }
}

async function oauthToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${squareBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      ...body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse>;
  if (!res.ok || !json.access_token || !json.merchant_id || !json.expires_at) {
    throw new SquareError("token request", res.status, json);
  }
  return json as TokenResponse;
}

/**
 * Tell Square to cancel access. `onlyThisToken` revokes just the one token rather
 * than the whole authorisation — used when we must discard a token without
 * disturbing any other session (see `completeSquareConnection`).
 */
async function revoke(accessToken: string, onlyThisToken = false): Promise<void> {
  const res = await fetch(`${squareBase()}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Client ${process.env.SQUARE_APPLICATION_SECRET}`,
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      access_token: accessToken,
      revoke_only_access_token: onlyThisToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new SquareError("revoke", res.status, await res.json().catch(() => ({})));
}

/**
 * A working access token for this account, refreshing it first if it's more than a
 * week old. `null` when the account isn't connected (or was connected under the
 * other environment — a sandbox token is meaningless in production and vice versa).
 */
export async function squareAccessToken(brandId: number): Promise<string | null> {
  const conn = await prisma.squareConnection.findUnique({ where: { brandId } });
  if (!conn || conn.environment !== squareEnvironment()) return null;

  if (conn.expiresAt.getTime() - Date.now() > REFRESH_WHEN_REMAINING_MS) {
    return decryptToken(conn.accessTokenEnc);
  }

  const refreshToken = decryptToken(conn.refreshTokenEnc);
  const fresh = await oauthToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  await prisma.squareConnection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encryptToken(fresh.access_token),
      // Code-flow refresh tokens don't change, but store whatever Square returns.
      refreshTokenEnc: encryptToken(fresh.refresh_token ?? refreshToken),
      expiresAt: new Date(fresh.expires_at),
    },
  });
  return fresh.access_token;
}

// ── Reading from Square ──────────────────────────────────────────────────────

async function squareGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${squareBase()}/v2${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SquareError(`GET ${path}`, res.status, json);
  return json as T;
}

export type SquareLocation = { id: string; name: string };

/** The business's ACTIVE locations — the ones a branch can be linked to. */
export async function fetchSquareLocations(accessToken: string): Promise<SquareLocation[]> {
  const { locations = [] } = await squareGet<{
    locations?: { id: string; name?: string; status?: string }[];
  }>(accessToken, "/locations");
  return locations
    .filter((l) => l.status !== "INACTIVE")
    .map((l) => ({ id: l.id, name: l.name?.trim() || l.id }));
}

/** The parts of a Square order that ScoreFlow reads — nothing about money or the
 *  customer. (Step 0 established that each tender's id IS the payment id, and a
 *  payment's receipt number is the first 4 characters of it.) */
export type SquareOrder = {
  id: string;
  location_id: string;
  created_at: string;
  state?: string;
  ticket_name?: string;
  line_items?: { name?: string }[];
  tenders?: { id?: string }[];
};

/**
 * One full order. Square's order webhooks are deliberately THIN — they name the
 * order but carry no dishes — so every event is followed by this fetch. A useful
 * side effect: we always act on the order as it is NOW, so events arriving late or
 * out of order can never leave a stale version behind.
 */
export async function fetchSquareOrder(accessToken: string, orderId: string): Promise<SquareOrder> {
  const { order } = await squareGet<{ order?: SquareOrder }>(
    accessToken,
    `/orders/${encodeURIComponent(orderId)}`
  );
  if (!order) throw new Error(`[square] order ${orderId} came back empty`);
  return order;
}

async function fetchMerchantName(accessToken: string, merchantId: string): Promise<string | null> {
  const { merchant } = await squareGet<{ merchant?: { business_name?: string } }>(
    accessToken,
    `/merchants/${encodeURIComponent(merchantId)}`
  );
  return merchant?.business_name?.trim() || null;
}

// ── Connect, link, disconnect ────────────────────────────────────────────────

export type ConnectOutcome = "connected" | "in-use";

/**
 * Finish "Connect Square": swap the one-time code for tokens, store them encrypted,
 * and — for the common one-location, one-branch business — link them up.
 */
export async function completeSquareConnection(
  brandId: number,
  code: string
): Promise<ConnectOutcome> {
  const tokens = await oauthToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: squareRedirectUri(),
  });

  // One Square business ↔ one ScoreFlow account. If this business already feeds a
  // DIFFERENT account, refuse — and throw away only the token just issued, so the
  // other account's connection keeps working.
  const owner = await prisma.squareConnection.findUnique({
    where: { merchantId: tokens.merchant_id },
    select: { brandId: true },
  });
  if (owner && owner.brandId !== brandId) {
    await revoke(tokens.access_token, true).catch(() => {});
    return "in-use";
  }

  const merchantName = await fetchMerchantName(tokens.access_token, tokens.merchant_id).catch(
    () => null
  );
  const previous = await prisma.squareConnection.findUnique({ where: { brandId } });

  const data = {
    merchantId: tokens.merchant_id,
    merchantName,
    accessTokenEnc: encryptToken(tokens.access_token),
    refreshTokenEnc: encryptToken(tokens.refresh_token ?? ""),
    expiresAt: new Date(tokens.expires_at),
    scopes: SQUARE_SCOPES.join(" "),
    environment: squareEnvironment(),
  };
  await prisma.$transaction(async (tx) => {
    // Reconnected to a DIFFERENT Square business: the old location links point at
    // somebody else's locations now, so they must go.
    if (previous && previous.merchantId !== tokens.merchant_id) {
      await tx.restaurant.updateMany({ where: { brandId }, data: { squareLocationId: null } });
    }
    await tx.squareConnection.upsert({
      where: { brandId },
      create: { brandId, ...data },
      update: data,
    });
  });

  // The usual case — one Square location, one ScoreFlow branch — needs no choice.
  try {
    const [locations, branches] = await Promise.all([
      fetchSquareLocations(tokens.access_token),
      prisma.restaurant.findMany({ where: { brandId }, select: { id: true, squareLocationId: true } }),
    ]);
    if (locations.length === 1 && branches.length === 1 && !branches[0].squareLocationId) {
      await prisma.restaurant.update({
        where: { id: branches[0].id },
        data: { squareLocationId: locations[0].id },
      });
    }
  } catch (err) {
    // Not fatal — the owner can pick the location in Settings.
    console.error("[square] auto-linking the location failed:", (err as Error).message);
  }

  return "connected";
}

/**
 * Link a branch to one of the business's Square locations (or unlink with `null`).
 * The location is checked against Square — never trusted from the browser.
 */
export async function linkSquareLocation(
  brandId: number,
  restaurantId: number,
  locationId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (locationId === null) {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { squareLocationId: null } });
    return { ok: true };
  }

  const token = await squareAccessToken(brandId);
  if (!token) return { error: "Square isn't connected." };
  const locations = await fetchSquareLocations(token);
  if (!locations.some((l) => l.id === locationId)) {
    return { error: "That location isn't part of your Square business." };
  }

  const taken = await prisma.restaurant.findUnique({
    where: { squareLocationId: locationId },
    select: { id: true, name: true, brandId: true },
  });
  if (taken && taken.id !== restaurantId) {
    // Only ever name a branch of the SAME account. Another account holding this
    // location "can't happen" (one Square business ↔ one account) — but if it ever
    // did, its branch name is somebody else's data and must not leak into this
    // owner's screen. Found while re-running the QA suite against a live connection.
    return {
      error:
        taken.brandId === brandId
          ? `That Square location is already linked to ${taken.name}.`
          : "That Square location is already linked to another ScoreFlow account.",
    };
  }

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { squareLocationId: locationId } });
  return { ok: true };
}

/**
 * Disconnect: ask Square to cancel access, then forget the tokens and every
 * location link. The local removal happens even if Square can't be reached —
 * the owner asked for the connection to end, and without the tokens nothing can
 * use it.
 */
export async function disconnectSquare(brandId: number): Promise<void> {
  const conn = await prisma.squareConnection.findUnique({ where: { brandId } });
  if (!conn) return;
  try {
    await revoke(decryptToken(conn.accessTokenEnc));
  } catch (err) {
    console.error("[square] revoke failed — removing the connection anyway:", (err as Error).message);
  }
  await prisma.$transaction([
    prisma.restaurant.updateMany({ where: { brandId }, data: { squareLocationId: null } }),
    prisma.squareConnection.delete({ where: { brandId } }),
  ]);
}

// ── What Settings shows ──────────────────────────────────────────────────────

export type SquareSettings = {
  configured: boolean;
  sandbox: boolean;
  /** Can orders actually arrive? (A webhook signature key is set.) */
  webhooksConfigured: boolean;
  connected: boolean;
  merchantName: string | null;
  /** `null` = connected, but Square couldn't be reached just now. */
  locations: (SquareLocation & { linkedTo: string | null })[] | null;
  thisLocationId: string | null;
};

/** Everything the Connect Square panel needs, for one branch of one account. */
export async function squareSettingsFor(
  brandId: number,
  restaurantId: number
): Promise<SquareSettings> {
  const base = {
    configured: squareIsConfigured(),
    sandbox: squareEnvironment() === "sandbox",
    webhooksConfigured: squareWebhooksConfigured(),
  };
  const conn = await prisma.squareConnection.findUnique({
    where: { brandId },
    select: { merchantName: true, environment: true },
  });
  if (!base.configured || !conn || conn.environment !== squareEnvironment()) {
    return { ...base, connected: false, merchantName: null, locations: null, thisLocationId: null };
  }

  const branches = await prisma.restaurant.findMany({
    where: { brandId },
    select: { id: true, name: true, squareLocationId: true },
  });
  const thisLocationId = branches.find((b) => b.id === restaurantId)?.squareLocationId ?? null;

  let locations: SquareSettings["locations"] = null;
  try {
    const token = await squareAccessToken(brandId);
    if (token) {
      locations = (await fetchSquareLocations(token)).map((l) => ({
        ...l,
        linkedTo:
          branches.find((b) => b.squareLocationId === l.id && b.id !== restaurantId)?.name ?? null,
      }));
    }
  } catch (err) {
    console.error("[square] couldn't load locations:", (err as Error).message);
  }

  return { ...base, connected: true, merchantName: conn.merchantName, locations, thisLocationId };
}
