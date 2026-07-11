/**
 * Auth.js (NextAuth v5) configuration — the heart of Milestone 5.
 *
 * This sets up EMAIL + PASSWORD login for restaurant owners using a
 * "Credentials" provider. We verify the password against a bcrypt hash stored
 * in our own database (no third-party auth service).
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
 * cookie — the browser cannot read or forge it, and it's signed with AUTH_SECRET
 * from .env.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getOwnerByEmail } from "@/lib/owners";
import { getOperatorByEmail } from "@/lib/operators";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Store the session as a signed cookie (required for Credentials login).
  session: { strategy: "jwt" },

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

        // 2. Find the account. We check OPERATORS first (platform admins), then
        //    fall back to restaurant OWNERS. An email belongs to at most one.
        const operator = await getOperatorByEmail(email);
        const owner = operator ? null : await getOwnerByEmail(email);
        const account = operator ?? owner;

        // 3. Verify the password. We ALWAYS run one bcrypt.compare — even when no
        //    account matched (against the dummy hash) — so the response takes the
        //    same time whether or not the email exists (anti-enumeration).
        const hashToCheck = account?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const passwordMatches = await bcrypt.compare(password, hashToCheck);

        if (!account || !passwordMatches) return null;

        // 4. Success. Return the MINIMAL session data, tagged with a `role` so the
        //    rest of the app knows which kind of user this is. All of this is set
        //    on the SERVER from the database; the browser never supplies it, which
        //    is what stops both cross-restaurant access and role tampering.
        if (operator) {
          return {
            id: `operator-${operator.id}`,
            email: operator.email,
            role: "operator" as const,
          };
        }
        return {
          id: `owner-${owner!.id}`,
          email: owner!.email,
          role: "owner" as const,
          restaurantId: owner!.restaurantId,
          restaurantSlug: owner!.restaurant.slug,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Runs whenever a JWT is created (at login, `user` is present) or refreshed.
     * We copy the restaurant info from the user onto the token so it persists in
     * the session cookie for later requests.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.restaurantSlug = user.restaurantSlug;
      }
      return token;
    },

    /**
     * Shapes what `auth()` returns to our server code. We expose the restaurant
     * info (from the token) on `session.user` so the dashboard guard can check
     * "does this owner own the restaurant in the URL?".
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.restaurantId = token.restaurantId;
        session.user.restaurantSlug = token.restaurantSlug;
      }
      return session;
    },
  },
});
