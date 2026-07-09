import "server-only";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

/*
  Normalize a relative SQLite `file:` URL to an absolute path anchored at the
  project root, so the runtime engine and the Prisma CLI agree on one file.
  Non-file URLs (e.g. Postgres in production) pass through untouched.
  Keep this in sync with prisma.config.ts.
*/
function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    if (!path.isAbsolute(p)) {
      return "file:" + path.resolve(process.cwd(), p);
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
