"use client";

import { useEffect, useState, useTransition } from "react";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_HEX,
  type HighlightColor,
} from "@/lib/constants";

/**
 * Compose a note for a selected passage. What "save" does is up to the caller
 * (typically: create a highlight-with-note anchored to the selection), so the
 * note is visible in the document and navigable from the Annotations panel.
 */
export default function NoteComposer({
  quote,
  onSave,
  onClose,
}: {
  quote: string | null;
  onSave: (comment: string, color: HighlightColor) => Promise<void>;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [pending, start] = useTransition();

  useEffect(() => {
    setComment("");
    setColor("yellow");
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
    start(async () => {
      await onSave(comment.trim(), color);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-sm font-semibold">📝 Highlight &amp; note</h3>
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
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted">Color</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`h-6 w-6 rounded-full border transition hover:scale-110 ${
                color === c ? "border-fg ring-2 ring-ring/40" : "border-line"
              }`}
              style={{ background: HIGHLIGHT_COLOR_HEX[c] }}
            />
          ))}
          <span className="flex-1" />
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
            Save highlight
          </button>
        </div>
      </div>
    </div>
  );
}
