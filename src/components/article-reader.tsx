"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createHighlight } from "@/app/actions/highlights";
import LookupPanel from "@/components/lookup-panel";
import NoteComposer from "@/components/note-composer";
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_HEX, type HighlightColor } from "@/lib/constants";

export type HighlightData = {
  id: string;
  text: string;
  color: string;
  locator: string | null;
};

type Locator = { start: number; end: number };

export default function ArticleReader({
  itemId,
  html,
  highlights,
}: {
  itemId: string;
  html: string;
  highlights: HighlightData[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{
    x: number;
    y: number;
    text: string;
    locator: Locator;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [lookupTerm, setLookupTerm] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ text: string; locator: Locator } | null>(null);
  const [progress, setProgress] = useState(0);

  // Reading progress based on page scroll.
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to (and briefly flash) a highlight when the panel requests it.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      const el = ref.current?.querySelector(`[data-hl="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("hl-flash");
      setTimeout(() => el.classList.remove("hl-flash"), 1600);
    };
    window.addEventListener("linkstash:goto", onGoto);
    return () => window.removeEventListener("linkstash:goto", onGoto);
  }, []);

  // (Re)render clean HTML and paint all highlights whenever inputs change.
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = html;
    for (const hl of highlights) {
      const loc = parseLocator(hl.locator);
      if (loc) paintHighlight(container, loc, hl.color, hl.id);
    }
  }, [html, highlights]);

  const onMouseUp = useCallback(() => {
    const container = ref.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPopover(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (
      !container.contains(range.startContainer) ||
      !container.contains(range.endContainer)
    ) {
      setPopover(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      setPopover(null);
      return;
    }
    const start = offsetOf(container, range.startContainer, range.startOffset);
    const end = offsetOf(container, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) return;

    const rect = range.getBoundingClientRect();
    setPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
      locator: { start: Math.min(start, end), end: Math.max(start, end) },
    });
  }, []);

  async function save(color: HighlightColor) {
    if (!popover) return;
    setSaving(true);
    try {
      await createHighlight({
        itemId,
        text: popover.text,
        locator: JSON.stringify(popover.locator),
        color,
      });
      window.getSelection()?.removeAllRanges();
      setPopover(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      {/* Reading progress */}
      <div className="fixed inset-x-0 top-0 z-30 h-0.5 bg-transparent">
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Text-size zoom */}
      <div className="mb-4 flex items-center justify-end gap-1">
        <button
          onClick={() => setFontScale((s) => Math.max(0.8, s - 0.1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
          title="Smaller text"
        >
          A−
        </button>
        <span className="w-10 text-center text-xs text-faint">
          {Math.round(fontScale * 100)}%
        </span>
        <button
          onClick={() => setFontScale((s) => Math.min(1.8, s + 0.1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-base text-muted transition hover:bg-surface-2 hover:text-fg"
          title="Larger text"
        >
          A+
        </button>
      </div>

      <div
        ref={ref}
        className="prose"
        onMouseUp={onMouseUp}
        onClick={(e) => {
          const mark = (e.target as Element).closest?.("mark[data-hl]");
          const id = mark?.getAttribute("data-hl");
          if (id)
            window.dispatchEvent(
              new CustomEvent("linkstash:focus", { detail: { id } }),
            );
        }}
        style={{ fontSize: `${(1.19 * fontScale).toFixed(3)}rem` }}
      />

      {popover && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-lg"
          style={{ left: popover.x, top: popover.y }}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              disabled={saving}
              onClick={() => save(c)}
              title={`Highlight ${c}`}
              className="h-6 w-6 rounded-full border border-line transition hover:scale-110"
              style={{ background: HIGHLIGHT_COLOR_HEX[c] }}
            />
          ))}
          <span className="mx-0.5 h-5 w-px bg-line" />
          <button
            onClick={() => {
              setLookupTerm(popover.text);
              window.getSelection()?.removeAllRanges();
              setPopover(null);
            }}
            title="Look up"
            className="flex h-6 items-center rounded-full px-1.5 text-sm hover:bg-surface-2"
          >
            🔍
          </button>
          <button
            onClick={() => {
              setNoteTarget({ text: popover.text, locator: popover.locator });
              window.getSelection()?.removeAllRanges();
              setPopover(null);
            }}
            title="Note this passage"
            className="flex h-6 items-center rounded-full px-1.5 text-sm hover:bg-surface-2"
          >
            📝
          </button>
        </div>
      )}

      <LookupPanel term={lookupTerm} onClose={() => setLookupTerm(null)} />
      <NoteComposer
        quote={noteTarget?.text ?? null}
        onClose={() => setNoteTarget(null)}
        onSave={async (comment, color) => {
          if (!noteTarget) return;
          await createHighlight({
            itemId,
            text: noteTarget.text,
            locator: JSON.stringify(noteTarget.locator),
            color,
            note: comment,
          });
          router.refresh();
        }}
      />
    </div>
  );
}

function parseLocator(raw: string | null): Locator | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (typeof o.start === "number" && typeof o.end === "number") return o;
  } catch {}
  return null;
}

/** Character offset of (node, offset) within container's text content. */
function offsetOf(
  container: HTMLElement,
  node: Node,
  offsetInNode: number,
): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return acc + offsetInNode;
    acc += current.nodeValue?.length ?? 0;
    current = walker.nextNode();
  }
  // If node is an element (e.g. selection ended at element boundary), fall back.
  return node.nodeType === Node.TEXT_NODE ? null : acc;
}

/** Wrap the [start,end) character range in a <mark>, skipping already-marked text. */
function paintHighlight(
  container: HTMLElement,
  loc: Locator,
  color: string,
  id: string,
) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let acc = 0;
  const targets: { node: Text; from: number; to: number }[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.nodeValue?.length ?? 0;
    const nodeStart = acc;
    const nodeEnd = acc + len;
    if (nodeEnd > loc.start && nodeStart < loc.end) {
      const alreadyMarked = (node.parentElement as HTMLElement | null)?.closest(
        "mark[data-hl]",
      );
      if (!alreadyMarked) {
        targets.push({
          node,
          from: Math.max(loc.start, nodeStart) - nodeStart,
          to: Math.min(loc.end, nodeEnd) - nodeStart,
        });
      }
    }
    acc = nodeEnd;
    if (acc >= loc.end) break;
    node = walker.nextNode() as Text | null;
  }

  const hex = HIGHLIGHT_COLOR_HEX[color as HighlightColor] ?? HIGHLIGHT_COLOR_HEX.yellow;
  for (const t of targets.reverse()) {
    try {
      const range = document.createRange();
      range.setStart(t.node, t.from);
      range.setEnd(t.node, t.to);
      const mark = document.createElement("mark");
      mark.setAttribute("data-hl", id);
      mark.style.backgroundColor = hex;
      range.surroundContents(mark);
    } catch {
      // Skip ranges that cross element boundaries.
    }
  }
}
