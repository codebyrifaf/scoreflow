/**
 * Auth.js HTTP endpoints.
 *
 * Auth.js needs a couple of server endpoints (for the sign-in POST, session
 * lookups, CSRF token, etc.). This catch-all route (`[...nextauth]`) at
 * `/api/auth/*` wires them up. We just re-export the GET/POST handlers that
 * `NextAuth(...)` built for us in auth.ts — there's no custom logic here.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
