/**
 * Auth.js (NextAuth v5) configuration — the heart of Milestone 5, hardened in M17.
 *
 * This sets up EMAIL + PASSWORD login for restaurant owners and platform
 * operators using a "Credentials" provider. We verify the password against a
 * bcrypt hash stored in our own database (no third-party auth service).
 *
 * What this file exports (used across the app):
 *   - `handlers`  → the GET/POST endpoints, re-exported by
 *                   app/api/auth/[...nextauth]/route.ts
 *   - `auth`      → read the current session on the server (in pages, the guard)
 *   - `signIn`    → called by the login server action
 *   - `signOut`   → called by the sign-out server action
 *
 * Session strategy: JWT. The Credentials provider requires JWT sessions (it does
 * not use a database "sessions" table). The session lives in a signed, HttpOnly
 * cookie — the browser cannot read or forge it, and it's signed with AUTH_SECRET.
 *
 * ── MILESTONE 17: what the token is allowed to say ───────────────────────────
 * The token now carries IDENTITY ONLY — "which account is this" (`accountId`,
 * `kind`, `tokenVersion`). It does NOT carry authority.
 *
 * It used to. `restaurantSlug` was stamped into the token at login and the guard
 * trusted it forever, which caused two real holes: a fired manager's month-old
 * cookie kept working, and because slugs can be renamed and re-used, a stale
 * cookie could end up matching a DIFFERENT customer's restaurant. Both are fixed
 * by moving the decision into the database — see lib/auth-guard.ts.
 *
 * `role` and the slugs are still carried, but ONLY for redirects and for showing
 * the right email in the header. **Never authorize on them.**
 */

import { headers } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getOwnerByEmail } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";
import { clientIpHash } from "@/lib/request-ip";
import {
  isThrottled,
  recordFailure,
  clearFailures,
  pruneOldAttempts,
} from "@/lib/login-attempts";

/**
 * A throwaway bcrypt hash computed once at startup.
 *
 * Why: when someone tries to log in with an email that doesn't exist, we still
 * run a bcrypt comparison against this dummy hash. That makes a "no such user"
 * response take about as long as a "wrong password" response, so an attacker
 * can't tell which emails are registered by measuring response time (a "user
 * enumeration via timing" attack).
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 10);

/** How long a signed-in session lasts before the user must log in again. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Store the session as a signed cookie (required for Credentials login).
  // `maxAge` was missing before M17, so sessions used Auth.js's 30-day default.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },

  // Send unauthenticated users to OUR login page instead of Auth.js's default.
  pages: { signIn: "/login" },

  providers: [
    Credentials({
      // These describe the fields Auth.js knows about. We render our own form,
      // so the labels here are mostly documentation.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * The core check. Auth.js calls this with whatever the login form sent.
       * Return a user object on success, or `null` on ANY failure (Auth.js turns
       * `null` into an "invalid credentials" error — we never say WHICH part was
       * wrong, so we don't leak whether an email exists).
       *
       * The brute-force guard lives HERE, not in app/login/actions.ts. That's
       * deliberate and important: Auth.js re-exports its handlers at
       * /api/auth/[...nextauth], so an attacker can POST straight to
       * /api/auth/callback/credentials and never touch our login form. Anything
       * we put in the form's server action would simply be walked around.
       */
      authorize: async (credentials) => {
        // 1. Read + normalise the input. Never assume the shape is correct.
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        // 2. Who is calling? We read the IP from a header our infrastructure
        //    sets, not one the client can forge (see lib/request-ip.ts).
        const ipHash = clientIpHash(await headers());

        // 3. BRUTE-FORCE GATE — before any bcrypt work.
        //    Checking first (rather than after verifying the password) means a
        //    blocked attacker costs us one indexed COUNT instead of a bcrypt
        //    hash, so flooding us can't burn our CPU either. We return the same
        //    `null` as a wrong password — never reveal that an account is locked.
        if (await isThrottled(email, ipHash)) return null;

        // 4. Find the account. We check OPERATORS first (platform admins), then
        //    fall back to restaurant OWNERS. An email belongs to at most one.
        const operator = await getOperatorByEmail(email);
        const owner = operator ? null : await getOwnerByEmail(email);
        const account = operator ?? owner;

        // 5. Verify the password. We ALWAYS run one bcrypt.compare — even when no
        //    account matched (against the dummy hash) — so the response takes the
        //    same time whether or not the email exists (anti-enumeration).
        const hashToCheck = account?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const passwordMatches = await bcrypt.compare(password, hashToCheck);

        if (!account || !passwordMatches) {
          await recordFailure(email, ipHash);
          return null;
        }

        // 6. Success — wipe this email's failed attempts so an honest user who
        //    fumbled their password isn't left carrying a penalty. Housekeeping
        //    is best-effort: never fail a valid login because a cleanup query did.
        try {
          await clearFailures(email);
          await pruneOldAttempts();
        } catch {
          // Ignore — the user is authenticated; tidying up can wait.
        }

        // 7. Return the MINIMAL session data. `accountId` + `kind` +
        //    `tokenVersion` are the IDENTITY the guards re-check against the
        //    database on every request. `role` and the slugs come along only so
        //    we can redirect and render — the guards must never authorize on them.
        if (operator) {
          return {
            id: `operator-${operator.id}`,
            accountId: operator.id,
            kind: "operator" as const,
            tokenVersion: operator.tokenVersion,
            email: operator.email,
            role: "operator" as const,
          };
        }
        // A brand-scoped owner (M16) → the brand console; a branch-scoped owner
        // (the original case) → their single branch. Exactly one is set.
        if (owner!.brandId && owner!.brand) {
          return {
            id: `owner-${owner!.id}`,
            accountId: owner!.id,
            kind: "owner" as const,
            tokenVersion: owner!.tokenVersion,
            email: owner!.email,
            role: "brand" as const,
            brandId: owner!.brandId,
            brandSlug: owner!.brand.slug,
          };
        }
        return {
          id: `owner-${owner!.id}`,
          accountId: owner!.id,
          kind: "owner" as const,
          tokenVersion: owner!.tokenVersion,
          email: owner!.email,
          role: "owner" as const,
          restaurantId: owner!.restaurantId ?? undefined,
          restaurantSlug: owner!.restaurant?.slug,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Runs whenever a JWT is created (at login, `user` is present) or refreshed.
     * We copy the identity onto the token so it persists in the session cookie.
     */
    async jwt({ token, user }) {
      if (user) {
        token.accountId = user.accountId;
        token.kind = user.kind;
        token.tokenVersion = user.tokenVersion;
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.restaurantSlug = user.restaurantSlug;
        token.brandId = user.brandId;
        token.brandSlug = user.brandSlug;
      }
      return token;
    },

    /**
     * Shapes what `auth()` returns to our server code.
     *
     * The guards take `accountId` + `tokenVersion` from here and go straight to
     * the database with them. Everything else on `session.user` is for display
     * and redirects only.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.accountId = token.accountId;
        session.user.kind = token.kind;
        session.user.tokenVersion = token.tokenVersion;
        session.user.role = token.role;
        session.user.restaurantId = token.restaurantId;
        session.user.restaurantSlug = token.restaurantSlug;
        session.user.brandId = token.brandId;
        session.user.brandSlug = token.brandSlug;
      }
      return session;
    },
  },
});
