import "server-only";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

/*
  Prisma resolves relative SQLite `file:` URLs against the *schema directory*
  (prisma/) for the CLI and Studio. The query engine at runtime, however,
  resolves them against the process CWD (the project root). To make the app,
  the CLI, and Studio all open the exact same file, we anchor relative `file:`
  URLs to the prisma/ directory here — matching the CLI/Studio convention.
  Non-file URLs (e.g. Postgres in production) pass through untouched.
*/
function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    if (!path.isAbsolute(p)) {
      // Desktop build: anchor relative paths to the app-data folder.
      // Dev/web: anchor to prisma/ (matches the CLI/Studio convention).
      const base = process.env.LINKSTASH_DATA_DIR
        ? process.env.LINKSTASH_DATA_DIR
        : path.resolve(process.cwd(), "prisma");
      return "file:" + path.resolve(base, p);
    }
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDbUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
