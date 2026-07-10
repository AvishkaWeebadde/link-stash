"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "@/app/actions/notes";
import ConfirmButton from "@/components/confirm-button";

type Note = {
  id: string;
  body: string;
  createdAt: string | Date;
};

export default function ItemNotes({
  itemId,
  notes,
}: {
  itemId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pending, start] = useTransition();

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
    <section className="mx-auto mt-12 max-w-2xl border-t border-line pt-8">
      <h2 className="mb-1 text-lg font-semibold">📝 Notes</h2>
      <p className="mb-4 text-sm text-muted">
        Jot a thought or summary about this item. Notes aren&apos;t tied to a
        highlight.
      </p>

      <div className="mb-6">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note… (e.g. why this paper matters, key takeaways)"
          rows={3}
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-faint">⌘/Ctrl + Enter to save</span>
          <button
            onClick={submit}
            disabled={pending || !draft.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-line bg-surface p-3.5">
            {editingId === n.id ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ring"
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
    </section>
  );
}
