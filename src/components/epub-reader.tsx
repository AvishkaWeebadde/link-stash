"use client";

import { useEffect, useRef, useState } from "react";
import { updateProgress } from "@/app/actions/items";
import { createHighlight } from "@/app/actions/highlights";
import ReadAloud from "@/components/read-aloud";
import LookupPanel from "@/components/lookup-panel";
import NoteComposer from "@/components/note-composer";
import BookmarksBar, { type BookmarkData } from "@/components/bookmarks-bar";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_HEX,
  type HighlightColor,
} from "@/lib/constants";

type ExistingHighlight = { id: string; color: string; locator: string | null };

export default function EpubReader({
  itemId,
  initialCfi,
  fallbackText = "",
  bookmarks = [],
  highlights,
}: {
  itemId: string;
  initialCfi: string | null;
  fallbackText?: string;
  bookmarks?: BookmarkData[];
  highlights: ExistingHighlight[];
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [fontPct, setFontPct] = useState(100);
  const [sectionText, setSectionText] = useState("");
  const [lookupTerm, setLookupTerm] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ cfi: string; text: string } | null>(null);
  const currentCfiRef = useRef<string>(initialCfi ?? "");

  // Apply font size to the rendition whenever it changes.
  useEffect(() => {
    try {
      renditionRef.current?.themes?.fontSize(`${fontPct}%`);
    } catch {}
  }, [fontPct]);

  // Jump to a highlight (CFI) when the Annotations panel requests it.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const loc = (e as CustomEvent).detail?.locator;
      if (loc) {
        try {
          renditionRef.current?.display(loc);
        } catch {}
      }
    };
    window.addEventListener("linkstash:goto", onGoto);
    return () => window.removeEventListener("linkstash:goto", onGoto);
  }, []);
  const [selection, setSelection] = useState<{ cfi: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    let book: { destroy: () => void } | null = null;

    (async () => {
      try {
        const ePub = (await import("epubjs")).default;
        if (cancelled || !viewerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b: any = ePub(`/files/${itemId}`);
        book = b;
        const rendition = b.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "auto",
        });
        renditionRef.current = rendition;

        await rendition.display(initialCfi || undefined);
        if (cancelled) return;
        setReady(true);
        updateSectionText(rendition);

        function updateSectionText(r: {
          getContents: () => unknown;
        }) {
          try {
            const raw = r.getContents();
            const arr = Array.isArray(raw) ? raw : [raw];
            const text = arr
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((c: any) => c?.document?.body?.innerText ?? "")
              .join("\n")
              .trim();
            setSectionText(text);
          } catch {
            setSectionText("");
          }
        }

        // Re-apply saved highlights.
        for (const hl of highlights) {
          if (hl.locator)
            addAnnotation(rendition, hl.locator, hl.color, () => dispatchFocus(hl.id));
        }

        // Generate locations for percentage-based progress (best effort).
        b.ready
          .then(() => b.locations.generate(1000))
          .catch(() => {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rendition.on("relocated", (loc: any) => {
          const percentage = loc?.start?.percentage ?? 0;
          const cfi = loc?.start?.cfi ?? "";
          setPct(Math.round(percentage * 100));
          if (cfi) {
            currentCfiRef.current = cfi;
            updateProgress(itemId, percentage, cfi).catch(() => {});
          }
          updateSectionText(rendition);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rendition.on("selected", (cfiRange: string, contents: any) => {
          const text = contents?.window?.getSelection?.().toString().trim() ?? "";
          if (text.length >= 2) setSelection({ cfi: cfiRange, text });
        });
      } catch {
        if (!cancelled) setError("Could not open this book.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        book?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function saveHighlight(color: HighlightColor, note?: string) {
    const rendition = renditionRef.current;
    const sel = selection;
    if (!sel || !rendition) return;
    setSelection(null);
    try {
      const id = await createHighlight({
        itemId,
        text: sel.text,
        locator: sel.cfi,
        color,
        note,
      });
      addAnnotation(rendition, sel.cfi, color, () => dispatchFocus(id));
    } catch {}
    // Clear the in-book selection.
    try {
      rendition.getContents().forEach((c: { window: Window }) =>
        c.window.getSelection()?.removeAllRanges(),
      );
    } catch {}
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs text-muted">{pct}%</span>
        <div className="flex items-center gap-1">
          <ZoomBtn onClick={() => setFontPct((p) => Math.max(70, p - 10))} label="A−" />
          <span className="w-9 text-center text-xs text-faint">{fontPct}%</span>
          <ZoomBtn onClick={() => setFontPct((p) => Math.min(200, p + 10))} label="A+" />
        </div>
        <ReadAloud text={sectionText || fallbackText} />
        <BookmarksBar
          itemId={itemId}
          bookmarks={bookmarks}
          getCurrentLocator={() => currentCfiRef.current || null}
          onJump={(cfi) => renditionRef.current?.display(cfi)}
          formatLabel={() => "Saved location"}
        />
      </div>

      <div className="relative rounded-xl border border-line bg-surface">
        <button
          onClick={() => renditionRef.current?.prev()}
          className="absolute left-0 top-0 z-10 flex h-full w-10 items-center justify-center text-2xl text-faint transition hover:bg-surface-2 hover:text-fg"
          aria-label="Previous page"
        >
          ‹
        </button>
        <div ref={viewerRef} className="mx-10 h-[72vh]" />
        <button
          onClick={() => renditionRef.current?.next()}
          className="absolute right-0 top-0 z-10 flex h-full w-10 items-center justify-center text-2xl text-faint transition hover:bg-surface-2 hover:text-fg"
          aria-label="Next page"
        >
          ›
        </button>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            Loading book…
          </div>
        )}
      </div>

      {selection && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 shadow-lg">
            <span className="mr-1 text-sm text-muted">Highlight:</span>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => saveHighlight(c)}
                className="h-7 w-7 rounded-full border border-line transition hover:scale-110"
                style={{ background: HIGHLIGHT_COLOR_HEX[c] }}
                aria-label={`Highlight ${c}`}
              />
            ))}
            <span className="mx-0.5 h-6 w-px bg-line" />
            <button
              onClick={() => {
                setLookupTerm(selection.text);
                setSelection(null);
              }}
              title="Look up"
              className="px-1.5 text-lg hover:opacity-70"
            >
              🔍
            </button>
            <button
              onClick={() => {
                setNoteTarget({ cfi: selection.cfi, text: selection.text });
                setSelection(null);
              }}
              title="Highlight & note this passage"
              className="px-1.5 text-lg hover:opacity-70"
            >
              📝
            </button>
            <button
              onClick={() => setSelection(null)}
              className="ml-1 px-2 text-muted hover:text-fg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <LookupPanel term={lookupTerm} onClose={() => setLookupTerm(null)} />
      <NoteComposer
        quote={noteTarget?.text ?? null}
        onClose={() => setNoteTarget(null)}
        onSave={async (comment, color) => {
          const rendition = renditionRef.current;
          if (!noteTarget) return;
          try {
            const id = await createHighlight({
              itemId,
              text: noteTarget.text,
              locator: noteTarget.cfi,
              color,
              note: comment,
            });
            if (rendition)
              addAnnotation(rendition, noteTarget.cfi, color, () =>
                dispatchFocus(id),
              );
          } catch {}
        }}
      />
    </div>
  );
}

function ZoomBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
    >
      {label}
    </button>
  );
}

function dispatchFocus(id: string) {
  window.dispatchEvent(new CustomEvent("linkstash:focus", { detail: { id } }));
}

function addAnnotation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rendition: any,
  cfiRange: string,
  color: string,
  onClick?: () => void,
) {
  const hex =
    HIGHLIGHT_COLOR_HEX[color as HighlightColor] ?? HIGHLIGHT_COLOR_HEX.yellow;
  try {
    rendition.annotations.add(
      "highlight",
      cfiRange,
      {},
      onClick,
      "linkstash-hl",
      { fill: hex, "fill-opacity": "0.4" },
    );
  } catch {
    /* ignore duplicate/invalid cfi */
  }
}
