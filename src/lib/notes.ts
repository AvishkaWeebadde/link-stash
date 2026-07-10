import "server-only";
import { db } from "@/lib/db";

/*
  The desktop app seeds its database from a template and does not run
  migrations on upgrade, so a pre-existing install may lack newer tables.
  ensureNoteTable() creates the Note table on demand (IF NOT EXISTS) to
  self-heal those databases. The schema here mirrors the Prisma migration.
*/
let ready: Promise<void> | null = null;

export function ensureNoteTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Note" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "itemId" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Note_itemId_idx" ON "Note"("itemId");`,
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt");`,
      );
    })();
  }
  return ready;
}

export async function listItemNotes(userId: string, itemId: string) {
  await ensureNoteTable();
  return db.note.findMany({
    where: { itemId, userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, createdAt: true, updatedAt: true },
  });
}

export type ItemNote = Awaited<ReturnType<typeof listItemNotes>>[number];
