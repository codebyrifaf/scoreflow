/**
 * A single, shared PrismaClient instance for the whole application.
 *
 * Everything that touches the database imports `prisma` from here.
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects to the database through a "driver adapter" instead of a
// bundled engine. For our PostgreSQL (Neon) database that adapter is `PrismaPg`,
// which uses the well-known `pg` driver under the hood. It needs the connection
// string, which Next.js loads from `.env` into process.env for us at runtime.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Fail loudly with a clear message rather than a confusing error later on.
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env file at the project root."
  );
}

// ── Why the global-singleton pattern? ───────────────────────────────────────
// In development, Next.js hot-reloads your code every time you save a file.
// Without the guard below, each reload would run this module again and create a
// brand-new PrismaClient — and therefore a brand-new database connection pool.
// After a few edits you'd exhaust the database's connection limit and start
// seeing "too many connections" errors. Caching the client on `globalThis`
// means every hot reload reuses the SAME instance.
//
// In production there is no hot-reloading, so we simply create the client once.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
