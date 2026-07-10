"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createHighlight,
  deleteHighlight,
  updateHighlightNote,
} from "@/app/actions/highlights";
import ConfirmButton from "@/components/confirm-button";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_HEX,
  type HighlightColor,
} from "@/lib/constants";

type Rect = { x: number; y: number; w: number; h: number };
export type PdfHighlight = {
  id: string;
  color: string;
  rect: Rect;
  note: string | null;
};

/**
 * Area/box highlights for a PDF page. Rectangles are stored normalized (0..1)
 * to the page, so they render correctly at any zoom (percentage positioning)
 * and work on any page — text or scanned image.
 */
export default function PdfAnnotations({
  itemId,
  page,
  highlights,
  active,
}: {
  itemId: string;
  page: number;
  highlights: PdfHighlight[];
  active: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [colorFor, setColorFor] = useState<Rect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [, start] = useTransition();

  // Flash a highlight when the panel jumps to it.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      setFlashId(id);
      const t = setTimeout(() => setFlashId(null), 1600);
      return () => clearTimeout(t);
    };
    window.addEventListener("linkstash:goto", onGoto);
    return () => window.removeEventListener("linkstash:goto", onGoto);
  }, []);

  function norm(clientX: number, clientY: number) {
    const r = rootRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    // Boxes handle their own clicks (and stop propagation), so a pointerdown
    // that reaches the overlay is on empty space: start drawing.
    if (!active || colorFor) return;
    const p = norm(e.clientX, e.clientY);
    setActiveId(null);
    dragStart.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const p = norm(e.clientX, e.clientY);
    const s = dragStart.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }

  function onPointerUp() {
    const d = draft;
    dragStart.current = null;
    setDraft(null);
    if (d && d.w > 0.01 && d.h > 0.01) setColorFor(d);
  }

  function saveColor(color: HighlightColor) {
    const rect = colorFor;
    if (!rect) return;
    setColorFor(null);
    start(async () => {
      await createHighlight({
        itemId,
        text: "",
        color,
        locator: JSON.stringify({ page, rect }),
      });
      router.refresh();
    });
  }

  const pct = (n: number) => `${n * 100}%`;
  const activeHl = highlights.find((h) => h.id === activeId) ?? null;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={{ zIndex: 2, pointerEvents: active ? "auto" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Saved highlights (clickable to focus the note, drawable over) */}
      {highlights.map((h) => (
        <div
          key={h.id}
          className="absolute cursor-pointer rounded-sm"
          style={{
            left: pct(h.rect.x),
            top: pct(h.rect.y),
            width: pct(h.rect.w),
            height: pct(h.rect.h),
            pointerEvents: "auto",
            background:
              (HIGHLIGHT_COLOR_HEX[h.color as HighlightColor] ??
                HIGHLIGHT_COLOR_HEX.yellow) + "66",
            outline:
              flashId === h.id
                ? "3px solid var(--ring)"
                : h.note
                  ? "2px solid " + HIGHLIGHT_COLOR_HEX.yellow
                  : "none",
          }}
          title={h.note ?? "Highlight"}
          onPointerDown={(e) => {
            if (active) e.stopPropagation();
          }}
          onClick={() => {
            if (active) {
              setActiveId(h.id);
              setNoteText(h.note ?? "");
            } else {
              window.dispatchEvent(
                new CustomEvent("linkstash:focus", { detail: { id: h.id } }),
              );
            }
          }}
        />
      ))}

      {/* Live draft rectangle */}
      {draft && (
        <div
          className="absolute border-2 border-accent bg-accent/20"
          style={{
            left: pct(draft.x),
            top: pct(draft.y),
            width: pct(draft.w),
            height: pct(draft.h),
          }}
        />
      )}

      {/* Color picker after drawing */}
      {colorFor && (
        <div
          className="absolute z-10 flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-lg"
          style={{ left: pct(colorFor.x), top: `calc(${pct(colorFor.y)} - 44px)` }}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => saveColor(c)}
              className="h-6 w-6 rounded-full border border-line transition hover:scale-110"
              style={{ background: HIGHLIGHT_COLOR_HEX[c] }}
              title={`Highlight ${c}`}
            />
          ))}
          <button
            onClick={() => setColorFor(null)}
            className="ml-1 px-1 text-muted hover:text-fg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selected highlight: note + delete */}
      {activeHl && (
        <div
          className="absolute z-10 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg"
          style={{
            left: pct(activeHl.rect.x),
            top: `calc(${pct(activeHl.rect.y + activeHl.rect.h)} + 6px)`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full resize-y rounded-lg border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-ring"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <ConfirmButton
              onConfirm={() =>
                start(async () => {
                  await deleteHighlight(activeHl.id);
                  setActiveId(null);
                  router.refresh();
                })
              }
              title="Delete highlight?"
              message="This highlight and its note will be removed."
              confirmLabel="Delete"
              className="text-sm text-muted hover:text-red-600"
              triggerTitle="Delete highlight"
            >
              Delete
            </ConfirmButton>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveId(null)}
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2"
              >
                Close
              </button>
              <button
                onClick={() =>
                  start(async () => {
                    await updateHighlightNote(activeHl.id, noteText);
                    setActiveId(null);
                    router.refresh();
                  })
                }
                className="rounded-lg bg-accent px-2.5 py-1 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
