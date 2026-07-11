/**
 * TypeScript augmentation for Auth.js.
 *
 * Out of the box, a session's `user` only has `name`/`email`/`image`, and the
 * JWT token has no custom fields. Milestone 5 adds two of our own —
 * `restaurantId` and `restaurantSlug` — so this file teaches TypeScript about
 * them. Without it, code like `session.user.restaurantSlug` would be a type
 * error even though we set it in auth.ts.
 *
 * (This is a types-only file; it emits no JavaScript.)
 */

import type { DefaultSession } from "next-auth";

/** Which kind of account is signed in (Milestone 6 added "operator"). */
type Role = "operator" | "owner";

declare module "next-auth" {
  /** The object returned from `authorize()` and passed into the `jwt` callback. */
  interface User {
    role?: Role;
    restaurantId?: number;
    restaurantSlug?: string;
  }

  /** What `auth()` returns to server code. */
  interface Session {
    user: {
      role?: Role;
      restaurantId?: number;
      restaurantSlug?: string;
    } & DefaultSession["user"];
  }
}

// NOTE: the `JWT` interface is actually declared in `@auth/core/jwt` (the
// `next-auth/jwt` path just re-exports it). TypeScript interface merging has to
// target the module that DECLARES the interface, so we augment `@auth/core/jwt`
// here — otherwise the extra fields wouldn't show up on the `token` in auth.ts.
declare module "@auth/core/jwt" {
  /** The decoded session token. We stash the role + restaurant info here. */
  interface JWT {
    role?: Role;
    restaurantId?: number;
    restaurantSlug?: string;
  }
}
