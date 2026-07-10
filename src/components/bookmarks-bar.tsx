"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addBookmark, deleteBookmark } from "@/app/actions/bookmarks";

export type BookmarkData = {
  id: string;
  locator: string;
  label: string | null;
};

/**
 * Bookmarks for a reader. The parent supplies the current position and how to
 * jump/format, so this works for PDFs (page), EPUBs (CFI), etc.
 */
export default function BookmarksBar({
  itemId,
  bookmarks,
  getCurrentLocator,
  onJump,
  formatLabel,
}: {
  itemId: string;
  bookmarks: BookmarkData[];
  getCurrentLocator: () => string | null;
  onJump: (locator: string) => void;
  formatLabel: (locator: string) => string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function add() {
    const locator = getCurrentLocator();
    if (!locator) return;
    const label = window.prompt("Bookmark note (optional):") ?? undefined;
    start(async () => {
      await addBookmark(itemId, locator, label || undefined);
      router.refresh();
      setOpen(true);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={add}
        disabled={pending}
        className="flex h-8 items-center rounded-lg px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
        title="Bookmark this spot"
      >
        🔖 Bookmark
      </button>
      {bookmarks.length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 items-center rounded-lg px-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
          title="Show bookmarks"
        >
          ▾ {bookmarks.length}
        </button>
      )}

      {open && bookmarks.length > 0 && (
        <div className="fixed right-4 top-16 z-40 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-faint">
            Bookmarks
          </p>
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
            >
              <button
                onClick={() => {
                  onJump(b.locator);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 text-left text-sm"
              >
                <span className="block font-medium text-accent">
                  {formatLabel(b.locator)}
                </span>
                {b.label && (
                  <span className="block truncate text-xs text-muted">
                    {b.label}
                  </span>
                )}
              </button>
              <button
                onClick={() =>
                  start(async () => {
                    await deleteBookmark(b.id);
                    router.refresh();
                  })
                }
                className="text-faint opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                title="Remove bookmark"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
