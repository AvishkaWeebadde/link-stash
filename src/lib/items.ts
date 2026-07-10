import "server-only";
import { db } from "@/lib/db";
import { searchItems } from "@/lib/search";
import type { ItemStatus, ItemType } from "@/lib/constants";

export type LibraryFilter = {
  type?: ItemType;
  status?: ItemStatus;
  favorite?: boolean;
  tagId?: string;
  collectionId?: string;
  search?: string;
};

const CARD_SELECT = {
  id: true,
  type: true,
  status: true,
  favorite: true,
  title: true,
  url: true,
  author: true,
  siteName: true,
  excerpt: true,
  coverImage: true,
  wordCount: true,
  progress: true,
  savedAt: true,
  tags: { select: { id: true, name: true, color: true } },
  _count: { select: { highlights: true } },
} as const;

/** List a user's items for the library grid, newest first. */
export async function listItems(userId: string, filter: LibraryFilter = {}) {
  return db.item.findMany({
    where: buildWhere(userId, filter),
    select: CARD_SELECT,
    orderBy: { savedAt: "desc" },
  });
}

/**
 * Library listing that routes through FTS5 when a search query is present
 * (ranked by relevance), otherwise falls back to the recency-ordered list.
 */
export async function listLibrary(userId: string, filter: LibraryFilter = {}) {
  const query = filter.search?.trim();
  if (!query) return listItems(userId, filter);

  const hits = await searchItems(userId, query);
  const ids = hits.map((h) => h.item_id);
  if (ids.length === 0) return [];

  const rest: LibraryFilter = { ...filter };
  delete rest.search;
  const where = { ...buildWhere(userId, rest), id: { in: ids } };
  const items = await db.item.findMany({ where, select: CARD_SELECT });

  const rank = new Map(ids.map((id, i) => [id, i]));
  return items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

function buildWhere(userId: string, filter: LibraryFilter) {
  const where: Record<string, unknown> = { userId };
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;
  if (filter.favorite) where.favorite = true;
  if (filter.tagId) where.tags = { some: { id: filter.tagId } };
  if (filter.collectionId)
    where.collections = { some: { id: filter.collectionId } };
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { title: { contains: q } },
      { excerpt: { contains: q } },
      { author: { contains: q } },
      { textContent: { contains: q } },
    ];
  }
  return where;
}

/** Counts used to render facet badges in the sidebar. */
export async function getSidebarCounts(userId: string) {
  const [byType, unread, favorite, total] = await Promise.all([
    db.item.groupBy({
      by: ["type"],
      where: { userId },
      _count: { _all: true },
    }),
    db.item.count({ where: { userId, status: "unread" } }),
    db.item.count({ where: { userId, favorite: true } }),
    db.item.count({ where: { userId } }),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const row of byType) typeCounts[row.type] = row._count._all;

  return { typeCounts, unread, favorite, total };
}

// Desktop databases predate newer columns (they seed from a template and don't
// run migrations), so add ocrData on demand. Memoized per process.
let itemColsReady: Promise<void> | null = null;
export function ensureItemColumns(): Promise<void> {
  if (!itemColsReady) {
    itemColsReady = (async () => {
      try {
        const cols = await db.$queryRawUnsafe<{ name: string }[]>(
          `PRAGMA table_info("Item")`,
        );
        if (!cols.some((c) => c.name === "ocrData")) {
          await db.$executeRawUnsafe(`ALTER TABLE "Item" ADD COLUMN "ocrData" TEXT`);
        }
      } catch {
        /* best effort */
      }
    })();
  }
  return itemColsReady;
}

/** Full item for the reader view (owner-scoped). */
export async function getItem(userId: string, id: string) {
  await ensureItemColumns();
  return db.item.findFirst({
    where: { id, userId },
    include: {
      tags: { select: { id: true, name: true, color: true } },
      collections: { select: { id: true, name: true } },
      highlights: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listTags(userId: string) {
  return db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, _count: { select: { items: true } } },
  });
}

export async function listCollections(userId: string) {
  return db.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { items: true } },
    },
  });
}

export type ItemCard = Awaited<ReturnType<typeof listItems>>[number];
