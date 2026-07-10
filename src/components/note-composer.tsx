"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addNote } from "@/app/actions/notes";

/**
 * Compose a note anchored to a selected passage. The quote is stored at the top
 * of the note body, followed by the user's comment. Works anywhere text can be
 * selected (articles, EPUBs, text PDFs).
 */
export default function NoteComposer({
  itemId,
  quote,
  onClose,
}: {
  itemId: string;
  quote: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    setComment("");
  }, [quote]);

  useEffect(() => {
    if (!quote) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quote, onClose]);

  if (!quote) return null;

  const trimmed = quote.length > 300 ? quote.slice(0, 300) + "…" : quote;

  function save() {
    const body = comment.trim()
      ? `“${trimmed}”\n\n${comment.trim()}`
      : `“${trimmed}”`;
    start(async () => {
      await addNote(itemId, body);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-sm font-semibold">📝 Note on this passage</h3>
        <blockquote className="mb-3 max-h-32 overflow-y-auto border-l-2 border-accent pl-3 text-sm italic text-muted">
          {trimmed}
        </blockquote>
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Your note (optional)…"
          className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
