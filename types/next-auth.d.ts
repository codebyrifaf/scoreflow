/**
 * TypeScript augmentation for Auth.js.
 *
 * Out of the box, a session's `user` only has `name`/`email`/`image`, and the JWT
 * token has no custom fields. This file teaches TypeScript about the ones we add
 * in auth.ts. Without it, `session.user.accountId` would be a type error even
 * though we set it.
 *
 * ── Two kinds of field, and the difference MATTERS (Milestone 17) ────────────
 *
 *  IDENTITY — `accountId`, `kind`, `tokenVersion`.
 *      "Which account is this, and is its session still valid?" The guards take
 *      these and go to the DATABASE to work out what the visitor may see.
 *
 *  DISPLAY / REDIRECT ONLY — `role`, `restaurantId`, `restaurantSlug`,
 *      `brandId`, `brandSlug`.
 *      Convenient for "where do I send this user after login?" and "whose email do
 *      I print in the header?". They are a SNAPSHOT taken at login and can go
 *      stale (a restaurant can be renamed, an owner reassigned or deleted).
 *      **Never make an authorization decision from these.** Doing exactly that is
 *      what let a stale cookie reach another tenant's dashboard before M17.
 *
 * (This is a types-only file; it emits no JavaScript.)
 */

import type { DefaultSession } from "next-auth";

/** Which kind of account is signed in.
 *  M6 added "operator"; M16 added "brand" (a brand owner across many branches).
 *  "owner" = a branch manager (single branch). */
type Role = "operator" | "brand" | "owner";

/** Which TABLE the account lives in — `Operator` or `Owner`. The guards need this
 *  to know where to look the account up. (A brand owner and a branch manager are
 *  both rows in `Owner`; they differ by `role`, not by `kind`.) */
type AccountKind = "operator" | "owner";

/** The identity claims — safe to authorize with, after a DB re-check. */
interface IdentityClaims {
  /** Primary key in the `Operator` or `Owner` table (see `kind`). */
  accountId?: number;
  kind?: AccountKind;
  /** Must still match the account's current `tokenVersion`, or the session is dead. */
  tokenVersion?: number;
}

/** The convenience claims — display and redirects only. Can be stale. */
interface DisplayClaims {
  role?: Role;
  restaurantId?: number;
  restaurantSlug?: string;
  brandId?: number;
  brandSlug?: string;
}

declare module "next-auth" {
  /** The object returned from `authorize()` and passed into the `jwt` callback. */
  interface User extends IdentityClaims, DisplayClaims {}

  /** What `auth()` returns to server code. */
  interface Session {
    user: IdentityClaims & DisplayClaims & DefaultSession["user"];
  }
}

// NOTE: the `JWT` interface is actually declared in `@auth/core/jwt` (the
// `next-auth/jwt` path just re-exports it). TypeScript interface merging has to
// target the module that DECLARES the interface, so we augment `@auth/core/jwt`
// here — otherwise the extra fields wouldn't show up on the `token` in auth.ts.
declare module "@auth/core/jwt" {
  /** The decoded session token. */
  interface JWT extends IdentityClaims, DisplayClaims {}
}
