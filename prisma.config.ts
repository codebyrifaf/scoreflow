/**
 * Prisma configuration (used by the Prisma CLI: `migrate`, `generate`, `studio`).
 *
 * Prisma 7 does NOT automatically load `.env`, so we import "dotenv/config" here
 * to load the project's `.env` into process.env before reading DATABASE_URL.
 * (The Next.js app itself loads `.env` on its own, so this file is only for the
 * command-line tooling.)
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The connection string lives in .env as DATABASE_URL (never committed).
    url: process.env.DATABASE_URL,
  },
});
