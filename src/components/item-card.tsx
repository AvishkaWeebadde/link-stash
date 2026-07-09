import Link from "next/link";
import FavoriteButton from "@/components/favorite-button";
import { ITEM_TYPE_ICONS, ITEM_TYPE_LABELS, type ItemType } from "@/lib/constants";
import type { ItemCard as ItemCardData } from "@/lib/items";

function readingTime(words: number | null): string | null {
  if (!words) return null;
  const mins = Math.max(1, Math.round(words / 220));
  return `${mins} min read`;
}

export default function ItemCard({ item }: { item: ItemCardData }) {
  const type = item.type as ItemType;
  const meta = [
    item.siteName || item.author,
    readingTime(item.wordCount),
  ].filter(Boolean);

  return (
    <Link
      href={`/read/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ring hover:shadow-sm"
    >
      {item.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverImage}
          alt=""
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-surface-2 text-4xl opacity-60">
          {ITEM_TYPE_ICONS[type]}
        </div>
      )}

      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-faint">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">
            {ITEM_TYPE_LABELS[type]}
          </span>
          {item.status === "unread" && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unread" />
          )}
          <span className="flex-1" />
          <FavoriteButton id={item.id} favorite={item.favorite} />
        </div>

        <h3 className="line-clamp-2 font-semibold leading-snug">{item.title}</h3>

        {item.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{item.excerpt}</p>
        )}

        {(type === "epub" || type === "pdf") && item.progress > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(item.progress * 100)}%` }}
            />
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5 text-xs text-faint">
          {meta.map((m, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-line">·</span>}
              {m}
            </span>
          ))}
          {item._count.highlights > 0 && (
            <span className="ml-auto">✏️ {item._count.highlights}</span>
          )}
        </div>

        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-muted"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: t.color }}
                />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
