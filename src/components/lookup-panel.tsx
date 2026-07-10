"use client";

import { useEffect, useState } from "react";

type LookupResult = {
  term: string;
  word: string;
  dict: {
    phonetic: string | null;
    entries: { partOfSpeech: string; meanings: string[] }[];
  } | null;
  wiki: { title: string; extract: string; url: string } | null;
};

export default function LookupPanel({
  term,
  onClose,
}: {
  term: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    setData(null);
    setLoading(true);
    fetch(`/api/lookup?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term]);

  useEffect(() => {
    if (!term) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [term, onClose]);

  if (!term) return null;

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(term)}`;
  const nothing = !loading && data && !data.dict && !data.wiki;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-faint">Look up</p>
            <h2 className="truncate text-lg font-semibold">{term}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {loading && <p className="text-sm text-muted">Looking up…</p>}

          {data?.dict && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-accent">
                Definition
                {data.dict.phonetic && (
                  <span className="ml-2 font-normal text-muted">
                    {data.dict.phonetic}
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                {data.dict.entries.map((e, i) => (
                  <div key={i}>
                    <p className="text-xs italic text-faint">{e.partOfSpeech}</p>
                    <ol className="ml-4 list-decimal space-y-1 text-sm">
                      {e.meanings.map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data?.wiki && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-accent">Wikipedia</h3>
              <p className="text-sm leading-relaxed text-fg">{data.wiki.extract}</p>
              <a
                href={data.wiki.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-accent hover:underline"
              >
                Read on Wikipedia ↗
              </a>
            </section>
          )}

          {nothing && (
            <p className="text-sm text-muted">
              No dictionary or Wikipedia entry found. Try a web search below.
            </p>
          )}
        </div>

        <div className="border-t border-line p-4">
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            🔍 Search the web for “{term.length > 30 ? term.slice(0, 30) + "…" : term}”
          </a>
        </div>
      </aside>
    </>
  );
}
