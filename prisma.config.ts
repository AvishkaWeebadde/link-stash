// Prisma CLI config. See https://pris.ly/prisma-config
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/*
  SQLite `file:` URLs are resolved differently by the Prisma CLI (relative to
  the schema directory) and the runtime engine (relative to the process CWD).
  To keep both pointing at the same file, we normalize any relative `file:`
  URL to an absolute path anchored at the project root. Non-file URLs
  (e.g. Postgres for production) pass through untouched.
*/
function resolveDbUrl(raw: string | undefined): string {
  const url = raw ?? "file:./prisma/dev.db";
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    if (!path.isAbsolute(p)) {
      return "file:" + path.resolve(process.cwd(), p);
    }
  }
  return url;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: resolveDbUrl(process.env.DATABASE_URL),
  },
});
