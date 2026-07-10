"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateProgress } from "@/app/actions/items";
import ReadAloud from "@/components/read-aloud";
import LookupPanel from "@/components/lookup-panel";
import NoteComposer from "@/components/note-composer";
import BookmarksBar, { type BookmarkData } from "@/components/bookmarks-bar";
import PdfAnnotations, { type PdfHighlight } from "@/components/pdf-annotations";

type RawHighlight = { id: string; color: string; locator: string | null; note: string | null };

export default function PdfReader({
  itemId,
  initialPage,
  fallbackText = "",
  bookmarks = [],
  highlights = [],
}: {
  itemId: string;
  initialPage: number;
  fallbackText?: string;
  bookmarks?: BookmarkData[];
  highlights?: RawHighlight[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [lookupTerm, setLookupTerm] = useState<string | null>(null);
  const [composeQuote, setComposeQuote] = useState<string | null>(null);
  const [selPopover, setSelPopover] = useState<{ x: number; y: number; text: string } | null>(null);

  const [page, setPage] = useState(Math.max(1, initialPage));
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [hlMode, setHlMode] = useState(false);
  const zoomRef = useRef(1);

  // Area highlights for the current page (locator = {page, rect}).
  const pageHighlights: PdfHighlight[] = highlights
    .map((h) => {
      try {
        const loc = h.locator ? JSON.parse(h.locator) : null;
        if (loc && loc.page === page && loc.rect) {
          return { id: h.id, color: h.color, rect: loc.rect, note: h.note };
        }
      } catch {
        /* not an area highlight */
      }
      return null;
    })
    .filter((h): h is PdfHighlight => h !== null);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsRef.current = pdfjs;
        const task = pdfjs.getDocument({ url: `/files/${itemId}` });
        const pdf = await task.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not open this PDF.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const renderPage = useCallback(async (n: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    const pageObj = await pdf.getPage(n);
    const dpr = window.devicePixelRatio || 1;
    const unscaled = pageObj.getViewport({ scale: 1 });
    const cssScale = (container.clientWidth / unscaled.width) * zoomRef.current;
    const viewport = pageObj.getViewport({ scale: cssScale * dpr });
    const cssViewport = pageObj.getViewport({ scale: cssScale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${cssViewport.width}px`;
    canvas.style.height = `${cssViewport.height}px`;
    if (stageRef.current) {
      stageRef.current.style.width = `${cssViewport.width}px`;
      stageRef.current.style.height = `${cssViewport.height}px`;
    }

    renderTaskRef.current?.cancel();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = pageObj.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch {
      /* cancelled render */
    }

    // Overlay a selectable text layer aligned to the canvas.
    const textDiv = textLayerRef.current;
    const pdfjs = pdfjsRef.current;
    if (textDiv && pdfjs?.TextLayer) {
      textDiv.innerHTML = "";
      textDiv.style.setProperty("--total-scale-factor", String(cssScale));
      try {
        await new pdfjs.TextLayer({
          textContentSource: pageObj.streamTextContent(),
          container: textDiv,
          viewport: cssViewport,
        }).render();
      } catch {
        /* text layer is best-effort */
      }
    }

    // Extract the page's text so Read aloud can speak it.
    try {
      const tc = await pageObj.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txt = tc.items.map((it: any) => it.str ?? "").join(" ");
      setPageText(txt);
    } catch {
      setPageText("");
    }
  }, []);

  // Render whenever the page, zoom, or load state changes.
  useEffect(() => {
    if (!loading) renderPage(page);
  }, [page, zoom, loading, renderPage]);

  // Jump to a highlight's page when the Annotations panel requests it.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      try {
        const loc = detail?.locator ? JSON.parse(detail.locator) : null;
        if (loc?.page) setPage(Math.max(1, loc.page));
      } catch {
        /* not a PDF locator */
      }
    };
    window.addEventListener("linkstash:goto", onGoto);
    return () => window.removeEventListener("linkstash:goto", onGoto);
  }, []);

  // Re-render on resize (debounced).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => renderPage(page), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [page, renderPage]);

  // Persist progress (debounced).
  useEffect(() => {
    if (!numPages) return;
    const t = setTimeout(() => {
      updateProgress(itemId, page / numPages, String(page)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [page, numPages, itemId]);

  const go = useCallback(
    (delta: number) =>
      setPage((p) => Math.min(numPages || 1, Math.max(1, p + delta))),
    [numPages],
  );

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onTextMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !sel || sel.rangeCount === 0) {
      setSelPopover(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelPopover({ x: rect.left + rect.width / 2, y: rect.top, text });
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
      <div className="sticky top-14 z-10 mb-4 flex flex-wrap items-center justify-center gap-3 rounded-full border border-line bg-surface px-3 py-1.5">
        <NavBtn onClick={() => go(-1)} disabled={page <= 1} label="‹" />
        <span className="min-w-24 text-center text-sm text-muted">
          {loading ? "Loading…" : `Page ${page} / ${numPages}`}
        </span>
        <NavBtn onClick={() => go(1)} disabled={page >= numPages} label="›" />
        <span className="h-4 w-px bg-line" />
        <NavBtn onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} disabled={zoom <= 0.5} label="−" />
        <span className="text-xs text-faint">{Math.round(zoom * 100)}%</span>
        <NavBtn onClick={() => setZoom((z) => Math.min(3, z + 0.15))} disabled={zoom >= 3} label="+" />
        <span className="h-4 w-px bg-line" />
        <button
          onClick={() => setHlMode((m) => !m)}
          className={`flex h-8 items-center rounded-lg px-2.5 text-sm transition ${
            hlMode
              ? "bg-accent-soft font-medium text-accent"
              : "text-muted hover:bg-surface-2 hover:text-fg"
          }`}
          title="Highlight mode — drag a box on the page"
        >
          ✏️ Highlight
        </button>
        <ReadAloud text={pageText || fallbackText} />
        <span className="h-4 w-px bg-line" />
        <BookmarksBar
          itemId={itemId}
          bookmarks={bookmarks}
          getCurrentLocator={() => String(page)}
          onJump={(l) => setPage(Math.min(numPages, Math.max(1, parseInt(l, 10) || 1)))}
          formatLabel={(l) => `Page ${l}`}
        />
      </div>
      <div ref={containerRef} className="flex justify-center">
        <div ref={stageRef} className="relative">
          <canvas ref={canvasRef} className="block rounded-lg shadow-sm" />
          <div
            ref={textLayerRef}
            className="pdf-text-layer"
            onMouseUp={onTextMouseUp}
          />
          <PdfAnnotations
            itemId={itemId}
            page={page}
            highlights={pageHighlights}
            active={hlMode}
          />
        </div>
      </div>

      {selPopover && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-lg"
          style={{ left: selPopover.x, top: selPopover.y - 8 }}
        >
          <button
            onClick={() => {
              setLookupTerm(selPopover.text);
              window.getSelection()?.removeAllRanges();
              setSelPopover(null);
            }}
            className="flex h-7 items-center gap-1 rounded-full px-2 text-sm hover:bg-surface-2"
            title="Look up"
          >
            🔍 Look up
          </button>
          <button
            onClick={() => {
              setComposeQuote(selPopover.text);
              window.getSelection()?.removeAllRanges();
              setSelPopover(null);
            }}
            className="flex h-7 items-center gap-1 rounded-full px-2 text-sm hover:bg-surface-2"
            title="Note this passage"
          >
            📝 Note
          </button>
        </div>
      )}

      <LookupPanel term={lookupTerm} onClose={() => setLookupTerm(null)} />
      <NoteComposer
        itemId={itemId}
        quote={composeQuote}
        onClose={() => setComposeQuote(null)}
      />
    </div>
  );
}

function NavBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30"
    >
      {label}
    </button>
  );
}
