"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "@/app/actions/notes";
import ConfirmButton from "@/components/confirm-button";

type Note = {
  id: string;
  body: string;
  createdAt: string | Date;
};

/**
 * A toolbar button that opens a slide-over panel of notes for the item.
 * Notes here include whole-item notes and notes captured from a passage.
 */
export default function ItemNotes({
  itemId,
  notes,
}: {
  itemId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    start(async () => {
      await addNote(itemId, body);
      setDraft("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
        title="Notes"
      >
        📝 Notes{notes.length > 0 && <span className="text-faint">{notes.length}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-lg font-semibold">📝 Notes</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-line p-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note about this item — a summary, a thought, a to-do…"
                rows={3}
                className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-faint">⌘/Ctrl+Enter</span>
                <button
                  onClick={submit}
                  disabled={pending || !draft.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  Add note
                </button>
              </div>
            </div>

            <ul className="flex-1 space-y-3 overflow-y-auto p-4">
              {notes.length === 0 && (
                <li className="text-sm text-muted">
                  No notes yet. Add one above, or select text and choose 📝 Note.
                </li>
              )}
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-line bg-bg p-3">
                  {editingId === n.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() =>
                            start(async () => {
                              await updateNote(n.id, editText);
                              setEditingId(null);
                              router.refresh();
                            })
                          }
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {n.body}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-faint">
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                        <span className="flex-1" />
                        <button
                          onClick={() => {
                            setEditingId(n.id);
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
          </aside>
        </>
      )}
    </>
  );
}
