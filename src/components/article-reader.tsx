"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createHighlight } from "@/app/actions/highlights";
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
      <div ref={ref} className="prose" onMouseUp={onMouseUp} />

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
        </div>
      )}
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
