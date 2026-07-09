"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHighlight, updateHighlightNote } from "@/app/actions/highlights";
import { HIGHLIGHT_COLOR_HEX, type HighlightColor } from "@/lib/constants";

export type HighlightItem = {
  id: string;
  text: string;
  color: string;
  note: string | null;
};

export default function HighlightsList({
  highlights,
}: {
  highlights: HighlightItem[];
}) {
  if (highlights.length === 0) return null;
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-faint">
        Highlights & Notes ({highlights.length})
      </h2>
      <div className="space-y-3">
        {highlights.map((h) => (
          <Row key={h.id} highlight={h} />
        ))}
      </div>
    </section>
  );
}

function Row({ highlight }: { highlight: HighlightItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight.note ?? "");
  const hex =
    HIGHLIGHT_COLOR_HEX[highlight.color as HighlightColor] ??
    HIGHLIGHT_COLOR_HEX.yellow;

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex gap-3">
        <div className="w-1 shrink-0 rounded-full" style={{ background: hex }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed">{highlight.text}</p>

          {editing ? (
            <div className="mt-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
              <div className="mt-1 flex gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await updateHighlightNote(highlight.id, note);
                      setEditing(false);
                      router.refresh();
                    })
                  }
                  className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-fg"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setNote(highlight.note ?? "");
                    setEditing(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : highlight.note ? (
            <p
              onClick={() => setEditing(true)}
              className="mt-2 cursor-text rounded-lg bg-surface-2 px-2 py-1.5 text-sm text-muted"
            >
              {highlight.note}
            </p>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-1.5 text-xs text-accent hover:underline"
            >
              + Add note
            </button>
          )}
        </div>

        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this highlight?"))
              start(async () => {
                await deleteHighlight(highlight.id);
                router.refresh();
              });
          }}
          className="h-6 shrink-0 text-faint transition hover:text-red-600"
          aria-label="Delete highlight"
          title="Delete highlight"
        >
          ×
        </button>
      </div>
    </div>
  );
}
