"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addTag,
  createCollection,
  removeTag,
  toggleItemInCollection,
} from "@/app/actions/organize";

type Tag = { id: string; name: string; color: string };
type Collection = { id: string; name: string };

export default function ItemOrganizer({
  itemId,
  tags,
  allCollections,
  memberCollectionIds,
}: {
  itemId: string;
  tags: Tag[];
  allCollections: Collection[];
  memberCollectionIds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showCollections, setShowCollections] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const members = new Set(memberCollectionIds);
  const inputRef = useRef<HTMLInputElement>(null);

  function submitTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newTag.trim();
    if (!name) return;
    setNewTag("");
    start(async () => {
      await addTag(itemId, name);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-line py-3 text-sm">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-2 pr-1 text-xs"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
          {t.name}
          <button
            onClick={() =>
              start(async () => {
                await removeTag(itemId, t.id);
                router.refresh();
              })
            }
            className="flex h-4 w-4 items-center justify-center rounded-full text-faint hover:bg-surface-2 hover:text-fg"
            aria-label={`Remove tag ${t.name}`}
          >
            ×
          </button>
        </span>
      ))}

      <form onSubmit={submitTag} className="inline-flex">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="+ tag"
          disabled={pending}
          className="w-20 rounded-full border border-dashed border-line bg-transparent px-2 py-0.5 text-xs outline-none focus:border-ring"
        />
      </form>

      <div className="relative">
        <button
          onClick={() => setShowCollections((s) => !s)}
          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-ring hover:text-fg"
        >
          📁 Collections{members.size > 0 ? ` (${members.size})` : ""}
        </button>

        {showCollections && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowCollections(false)}
            />
            <div className="absolute left-0 top-8 z-50 w-60 rounded-xl border border-line bg-surface p-2 shadow-lg">
              <div className="max-h-52 space-y-0.5 overflow-y-auto">
                {allCollections.length === 0 && (
                  <p className="px-2 py-1 text-xs text-faint">
                    No collections yet.
                  </p>
                )}
                {allCollections.map((c) => {
                  const inIt = members.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        start(async () => {
                          await toggleItemInCollection(itemId, c.id, !inIt);
                          router.refresh();
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="w-4">{inIt ? "✓" : ""}</span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newCollection.trim();
                  if (!name) return;
                  setNewCollection("");
                  start(async () => {
                    const id = await createCollection(name);
                    await toggleItemInCollection(itemId, id, true);
                    router.refresh();
                  });
                }}
                className="mt-1 border-t border-line pt-1"
              >
                <input
                  ref={inputRef}
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  placeholder="+ New collection"
                  className="w-full rounded-lg bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
                />
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
