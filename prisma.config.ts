// Prisma CLI config. See https://pris.ly/prisma-config
// `dotenv/config` loads .env so env("DATABASE_URL") resolves.
// The datasource URL is passed through as-is: for SQLite, the CLI and Prisma
// Studio resolve a relative `file:` path against the prisma/ schema directory.
// src/lib/db.ts anchors the app runtime to that same directory, so the app,
// CLI, and Studio all open the identical SQLite file.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
