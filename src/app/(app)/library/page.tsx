import AddItem from "@/components/add-item";
import ItemCard from "@/components/item-card";
import SearchBox from "@/components/search-box";
import { requireUser } from "@/lib/dal";
import { listLibrary, type LibraryFilter } from "@/lib/items";
import {
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  type ItemStatus,
  type ItemType,
} from "@/lib/constants";
import { db } from "@/lib/db";

type SearchParams = Promise<{
  type?: string;
  status?: string;
  favorite?: string;
  tag?: string;
  collection?: string;
  search?: string;
}>;

async function titleFor(
  filter: LibraryFilter,
  userId: string,
): Promise<string> {
  if (filter.search) return `Search: “${filter.search}”`;
  if (filter.favorite) return "Favorites";
  if (filter.status === "unread") return "Unread";
  if (filter.type) return ITEM_TYPE_LABELS[filter.type] + "s";
  if (filter.tagId) {
    const tag = await db.tag.findFirst({
      where: { id: filter.tagId, userId },
      select: { name: true },
    });
    return tag ? `#${tag.name}` : "Library";
  }
  if (filter.collectionId) {
    const c = await db.collection.findFirst({
      where: { id: filter.collectionId, userId },
      select: { name: true },
    });
    return c ? c.name : "Library";
  }
  return "All items";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await requireUser();
  const sp = await searchParams;

  const filter: LibraryFilter = {
    type: ITEM_TYPES.includes(sp.type as ItemType)
      ? (sp.type as ItemType)
      : undefined,
    status: sp.status === "unread" ? ("unread" as ItemStatus) : undefined,
    favorite: sp.favorite === "1",
    tagId: sp.tag,
    collectionId: sp.collection,
    search: sp.search,
  };

  const [items, heading] = await Promise.all([
    listLibrary(userId, filter),
    titleFor(filter, userId),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <div className="flex items-center gap-2">
          <SearchBox />
          <AddItem />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState searching={!!filter.search} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-20 text-center">
      <div className="mb-3 text-5xl opacity-50">{searching ? "🔍" : "📚"}</div>
      <h2 className="text-lg font-semibold">
        {searching ? "No matches found" : "Your library is empty"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {searching
          ? "Try a different search term."
          : "Save an article, import a PDF or book, or jot a note. Everything you read lives here — searchable and yours."}
      </p>
    </div>
  );
}
