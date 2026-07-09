import "server-only";
import { db } from "@/lib/db";

/*
  Full-text search backed by SQLite's FTS5 extension.

  We keep a standalone FTS5 table `item_fts(item_id, user_id, title, body)`
  and maintain it explicitly from the item mutation actions. This avoids
  coupling to Prisma's internal rowids and keeps queries simple.
*/

let ready: Promise<void> | null = null;

/** Create the FTS5 virtual table once per process (idempotent). */
function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = db
      .$executeRawUnsafe(
        `CREATE VIRTUAL TABLE IF NOT EXISTS item_fts USING fts5(
           item_id UNINDEXED,
           user_id UNINDEXED,
           title,
           body,
           tokenize = 'porter unicode61'
         );`,
      )
      .then(() => undefined);
  }
  return ready;
}

export async function indexItem(
  itemId: string,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await ensureSchema();
  await db.$executeRawUnsafe(`DELETE FROM item_fts WHERE item_id = ?`, itemId);
  await db.$executeRawUnsafe(
    `INSERT INTO item_fts (item_id, user_id, title, body) VALUES (?, ?, ?, ?)`,
    itemId,
    userId,
    title,
    body,
  );
}

export async function removeFromIndex(itemId: string): Promise<void> {
  await ensureSchema();
  await db.$executeRawUnsafe(`DELETE FROM item_fts WHERE item_id = ?`, itemId);
}

export type SearchHit = {
  item_id: string;
  title: string;
  snippet: string;
};

/**
 * Full-text search within a user's library. Returns item ids ranked by
 * relevance, plus a highlighted snippet from the body.
 */
export async function searchItems(
  userId: string,
  query: string,
  limit = 50,
): Promise<SearchHit[]> {
  await ensureSchema();
  const match = toMatchQuery(query);
  if (!match) return [];

  return db.$queryRawUnsafe<SearchHit[]>(
    `SELECT item_id,
            title,
            snippet(item_fts, 3, '<b>', '</b>', '…', 12) AS snippet
       FROM item_fts
      WHERE user_id = ? AND item_fts MATCH ?
      ORDER BY rank
      LIMIT ?`,
    userId,
    match,
    limit,
  );
}

/**
 * Turn free-text into a safe FTS5 MATCH expression: split into tokens,
 * quote each (so punctuation can't break the query), and prefix-match the
 * final token for as-you-type behavior.
 */
function toMatchQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .replace(/["*()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  return tokens
    .map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`))
    .join(" AND ");
}
