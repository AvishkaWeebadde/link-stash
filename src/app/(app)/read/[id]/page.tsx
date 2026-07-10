import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleReader from "@/components/article-reader";
import EpubReader from "@/components/epub-reader";
import FavoriteButton from "@/components/favorite-button";
import HighlightsList from "@/components/highlights-list";
import ItemActions from "@/components/item-actions";
import ItemNotes from "@/components/item-notes";
import ItemOrganizer from "@/components/item-organizer";
import PdfReader from "@/components/pdf-reader";
import ReadAloud from "@/components/read-aloud";
import { listItemNotes } from "@/lib/notes";
import { listItemBookmarks } from "@/lib/bookmarks";
import { requireUser } from "@/lib/dal";
import { getItem, listCollections } from "@/lib/items";
import {
  ITEM_TYPE_LABELS,
  itemFormat,
  type ItemStatus,
  type ItemType,
} from "@/lib/constants";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await requireUser();
  const { id } = await params;
  const item = await getItem(userId, id);
  if (!item) notFound();

  const allCollections = await listCollections(userId);
  const notes = await listItemNotes(userId, item.id);
  const bookmarks = (await listItemBookmarks(userId, item.id)).map((b) => ({
    id: b.id,
    locator: b.locator,
    label: b.label,
  }));

  const type = item.type as ItemType;
  const format = itemFormat(item.filePath);
  const minutes = item.wordCount
    ? Math.max(1, Math.round(item.wordCount / 220))
    : null;

  return (
    <div className="min-h-dvh">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/library"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            title="Back to library"
          >
            ←
          </Link>
          <span className="flex-1 truncate text-sm text-muted">{item.title}</span>
          {format === "html" && item.textContent && (
            <ReadAloud text={item.textContent} />
          )}
          <FavoriteButton id={item.id} favorite={item.favorite} className="text-lg" />
          <ItemActions id={item.id} status={item.status as ItemStatus} />
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <span className="text-xs font-medium uppercase tracking-wider text-accent">
            {ITEM_TYPE_LABELS[type]}
          </span>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {item.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {item.author && <span>{item.author}</span>}
            {item.siteName && <span>· {item.siteName}</span>}
            {minutes && <span>· {minutes} min read</span>}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                · View original ↗
              </a>
            )}
          </div>

          <div className="mt-4">
            <ItemOrganizer
              itemId={item.id}
              tags={item.tags}
              allCollections={allCollections.map((c) => ({ id: c.id, name: c.name }))}
              memberCollectionIds={item.collections.map((c) => c.id)}
            />
          </div>
        </div>

        {format === "html" ? (
          item.contentHtml ? (
            <>
              <ArticleReader
                itemId={item.id}
                html={item.contentHtml}
                highlights={item.highlights.map((h) => ({
                  id: h.id,
                  text: h.text,
                  color: h.color,
                  locator: h.locator,
                }))}
              />
              <HighlightsList
                highlights={item.highlights.map((h) => ({
                  id: h.id,
                  text: h.text,
                  color: h.color,
                  note: h.note,
                }))}
              />
            </>
          ) : (
            <p className="text-muted">This item has no readable content.</p>
          )
        ) : format === "pdf" ? (
          <>
            <PdfReader
              itemId={item.id}
              initialPage={item.locator ? parseInt(item.locator, 10) || 1 : 1}
              fallbackText={item.textContent ?? ""}
              bookmarks={bookmarks}
            />
            <HighlightsList
              highlights={item.highlights.map((h) => ({
                id: h.id,
                text: h.text,
                color: h.color,
                note: h.note,
              }))}
            />
          </>
        ) : format === "epub" ? (
          <>
            <EpubReader
              itemId={item.id}
              initialCfi={item.locator}
              fallbackText={item.textContent ?? ""}
              bookmarks={bookmarks}
              highlights={item.highlights.map((h) => ({
                id: h.id,
                color: h.color,
                locator: h.locator,
              }))}
            />
            <HighlightsList
              highlights={item.highlights.map((h) => ({
                id: h.id,
                text: h.text,
                color: h.color,
                note: h.note,
              }))}
            />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
            Unsupported item type.
          </div>
        )}

        <ItemNotes
          itemId={item.id}
          notes={notes.map((n) => ({
            id: n.id,
            body: n.body,
            createdAt: n.createdAt,
          }))}
        />
      </article>
    </div>
  );
}
