"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateProgress } from "@/app/actions/items";
import ReadAloud from "@/components/read-aloud";

export default function PdfReader({
  itemId,
  initialPage,
}: {
  itemId: string;
  initialPage: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [page, setPage] = useState(Math.max(1, initialPage));
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
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
    const scale = (container.clientWidth / unscaled.width) * dpr * zoomRef.current;
    const viewport = pageObj.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

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

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-14 z-10 mb-4 flex items-center justify-center gap-3 rounded-full border border-line bg-surface/90 px-3 py-1.5 backdrop-blur">
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
        <ReadAloud text={pageText} />
      </div>
      <div ref={containerRef} className="flex justify-center">
        <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
      </div>
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
