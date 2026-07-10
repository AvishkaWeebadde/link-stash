"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { addNote, deleteNote, updateNote } from "@/app/actions/notes";
import { deleteHighlight, updateHighlightNote } from "@/app/actions/highlights";
import ConfirmButton from "@/components/confirm-button";
import { HIGHLIGHT_COLOR_HEX, type HighlightColor } from "@/lib/constants";

type NoteRow = { id: string; body: string; createdAt: string | Date };
type HighlightRow = {
  id: string;
  text: string;
  color: string;
  note: string | null;
  locator: string | null;
};

function pageOf(locator: string | null): number | null {
  if (!locator) return null;
  try {
    const o = JSON.parse(locator);
    return typeof o.page === "number" ? o.page : null;
  } catch {
    return null;
  }
}

/**
 * Unified Annotations panel: every highlight (with its note) and every
 * standalone note for the item, in one toolbar-accessible slide-over.
 * Clicking a highlight jumps to it in the reader (via a window event the
 * reader listens for).
 */
export default function ItemNotes({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [, start] = useTransition();

  const count = notes.length + highlights.length;

  async function refresh() {
    try {
      const res = await fetch(`/api/annotations?itemId=${encodeURIComponent(itemId)}`);
      if (res.ok) {
        const d = await res.json();
        setNotes(d.notes ?? []);
        setHighlights(d.highlights ?? []);
      }
    } catch {
      /* keep existing */
    }
  }

  useEffect(() => {
    setMounted(true);
    refresh();
    // Open + focus a specific annotation when a highlight is clicked in the doc.
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      setOpen(true);
      refresh();
      setFocusId(id);
    };
    window.addEventListener("linkstash:focus", onFocus);
    return () => window.removeEventListener("linkstash:focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the focused annotation into view once the panel has it.
  useEffect(() => {
    if (!focusId || !open) return;
    const t = setTimeout(() => {
      document
        .getElementById(`anno-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clear = setTimeout(() => setFocusId(null), 2000);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [focusId, open, highlights, notes]);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goto(h: HighlightRow) {
    window.dispatchEvent(
      new CustomEvent("linkstash:goto", { detail: { id: h.id, locator: h.locator } }),
    );
    setOpen(false);
  }

  function addGeneralNote() {
    const body = draft.trim();
    if (!body) return;
    start(async () => {
      await addNote(itemId, body);
      setDraft("");
      await refresh();
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
        title="Annotations & notes"
      >
        📝 Notes{count > 0 && <span className="text-faint">{count}</span>}
      </button>

      {open &&
        mounted &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[100] bg-black/50" onClick={() => setOpen(false)} />
            <aside className="fixed right-0 top-0 z-[100] flex h-dvh w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-lg font-semibold">📝 Annotations</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Highlights */}
                {highlights.length > 0 && (
                  <div className="border-b border-line p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                      Highlights
                    </p>
                    <ul className="space-y-2">
                      {highlights.map((h) => {
                        const pg = pageOf(h.locator);
                        return (
                          <li
                            key={h.id}
                            id={`anno-${h.id}`}
                            className={`rounded-xl border bg-bg p-3 transition ${
                              focusId === h.id
                                ? "border-accent ring-2 ring-accent/40"
                                : "border-line"
                            }`}
                          >
                            <button
                              onClick={() => goto(h)}
                              className="block w-full text-left"
                              title="Jump to this highlight"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 shrink-0 rounded-sm"
                                  style={{
                                    background:
                                      HIGHLIGHT_COLOR_HEX[h.color as HighlightColor] ??
                                      HIGHLIGHT_COLOR_HEX.yellow,
                                  }}
                                />
                                <span className="line-clamp-2 text-sm">
                                  {h.text?.trim()
                                    ? `“${h.text.trim()}”`
                                    : pg
                                      ? `Area highlight · page ${pg}`
                                      : "Highlight"}
                                </span>
                              </span>
                            </button>

                            {editId === h.id ? (
                              <div className="mt-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={2}
                                  placeholder="Note…"
                                  className="w-full resize-y rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ring"
                                />
                                <div className="mt-1 flex justify-end gap-2 text-sm">
                                  <button onClick={() => setEditId(null)} className="text-muted hover:text-fg">Cancel</button>
                                  <button
                                    onClick={() =>
                                      start(async () => {
                                        await updateHighlightNote(h.id, editText);
                                        setEditId(null);
                                        await refresh();
                                        router.refresh();
                                      })
                                    }
                                    className="font-medium text-accent"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1.5 flex items-center gap-3 text-xs">
                                {h.note ? (
                                  <span className="flex-1 whitespace-pre-wrap text-muted">
                                    {h.note}
                                  </span>
                                ) : (
                                  <span className="flex-1 text-faint">No note</span>
                                )}
                                <button
                                  onClick={() => {
                                    setEditId(h.id);
                                    setEditText(h.note ?? "");
                                  }}
                                  className="text-muted hover:text-fg"
                                >
                                  {h.note ? "Edit" : "＋ Note"}
                                </button>
                                <ConfirmButton
                                  onConfirm={() =>
                                    start(async () => {
                                      await deleteHighlight(h.id);
                                      await refresh();
                                      router.refresh();
                                    })
                                  }
                                  title="Delete highlight?"
                                  message="The highlight and its note will be removed."
                                  confirmLabel="Delete"
                                  className="text-muted hover:text-red-600"
                                  triggerTitle="Delete highlight"
                                >
                                  Delete
                                </ConfirmButton>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                <div className="p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                    Notes
                  </p>
                  {notes.length === 0 && (
                    <p className="mb-3 text-sm text-muted">
                      No notes yet — add one below, or select text and choose 📝 Note.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        id={`anno-${n.id}`}
                        className={`rounded-xl border bg-bg p-3 transition ${
                          focusId === n.id
                            ? "border-accent ring-2 ring-accent/40"
                            : "border-line"
                        }`}
                      >
                        {editId === n.id ? (
                          <div>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={3}
                              className="w-full resize-y rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ring"
                            />
                            <div className="mt-1 flex justify-end gap-2 text-sm">
                              <button onClick={() => setEditId(null)} className="text-muted hover:text-fg">Cancel</button>
                              <button
                                onClick={() =>
                                  start(async () => {
                                    await updateNote(n.id, editText);
                                    setEditId(null);
                                    await refresh();
                                    router.refresh();
                                  })
                                }
                                className="font-medium text-accent"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                            <div className="mt-1.5 flex items-center gap-3 text-xs text-faint">
                              <span className="flex-1">{new Date(n.createdAt).toLocaleString()}</span>
                              <button
                                onClick={() => {
                                  setEditId(n.id);
                                  setEditText(n.body);
                                }}
                                className="hover:text-fg"
                              >
                                Edit
                              </button>
                              <ConfirmButton
                                onConfirm={() =>
                                  start(async () => {
                                    await deleteNote(n.id);
                                    await refresh();
                                    router.refresh();
                                  })
                                }
                                title="Delete note?"
                                message="This note will be permanently removed."
                                confirmLabel="Delete"
                                className="hover:text-red-600"
                                triggerTitle="Delete note"
                              >
                                Delete
                              </ConfirmButton>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Add a general note */}
              <div className="border-t border-line p-4">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a note about this item…"
                  rows={2}
                  className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addGeneralNote();
                  }}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={addGeneralNote}
                    disabled={!draft.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                  >
                    Add note
                  </button>
                </div>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
