import "server-only";
import { db } from "@/lib/db";

// See ensureNoteTable in lib/notes.ts — same self-heal for desktop databases
// that predate this table's migration.
let ready: Promise<void> | null = null;

export function ensureBookmarkTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Bookmark" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "itemId" TEXT NOT NULL,
          "locator" TEXT NOT NULL,
          "label" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Bookmark_itemId_idx" ON "Bookmark"("itemId");`,
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");`,
      );
    })();
  }
  return ready;
}

export async function listItemBookmarks(userId: string, itemId: string) {
  await ensureBookmarkTable();
  return db.bookmark.findMany({
    where: { itemId, userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, locator: true, label: true, createdAt: true },
  });
}

export type ItemBookmark = Awaited<
  ReturnType<typeof listItemBookmarks>
>[number];
