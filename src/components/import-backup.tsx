"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const KIND_LABEL: Record<string, string> = {
  bookmarks: "bookmarks",
  urls: "URLs",
  bibtex: "references",
};

type Toast = { kind: "ok" | "err"; text: string; path?: string } | null;
type Progress = { label: string; value: number | null } | null; // null value = indeterminate

export default function ImportBackup() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "import" | "backup" | "restore">(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Auto-dismiss transient toasts (keep ones that show a saved path).
  useEffect(() => {
    if (!toast || toast.path) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  async function runImport(body: FormData) {
    setBusy("import");
    setToast(null);
    setProgress({ label: "Reading your list…", value: null });
    try {
      const res = await fetch("/api/import", { method: "POST", body });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Import failed (HTTP ${res.status})`);
      }
      // Read newline-delimited JSON progress.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let total = 0;
      let label = "Importing…";
      let done: { imported: number; skipped: number; total: number; kind: string } | null = null;
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "start") {
            total = msg.total;
            label = `Importing ${total} ${KIND_LABEL[msg.kind] ?? "links"}…`;
            setProgress(total > 0 ? { label, value: 0 } : { label: "Checking…", value: null });
          } else if (msg.type === "progress") {
            setProgress({ label, value: Math.round((msg.done / Math.max(1, total)) * 100) });
          } else if (msg.type === "done") {
            done = msg;
          }
        }
      }
      if (done) {
        const label = KIND_LABEL[done.kind] ?? "links";
        setToast({
          kind: "ok",
          text:
            done.imported > 0
              ? `Imported ${done.imported} ${label}${done.skipped ? ` · skipped ${done.skipped} already in your library` : ""}. Open one to fetch its full text.`
              : `Nothing new — all ${done.total} were already in your library.`,
        });
      }
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : "Import failed." });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    runImport(body);
  }

  function onImportText() {
    if (!text.trim()) return;
    const body = new FormData();
    body.append("text", text);
    body.append("filename", "list.txt");
    runImport(body);
  }

  async function onBackup() {
    setBusy("backup");
    setToast(null);
    setProgress({ label: "Preparing your backup…", value: null });
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error(`Backup failed (HTTP ${res.status})`);
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        // Desktop: saved server-side, we know the exact path.
        const data = await res.json();
        setToast({
          kind: "ok",
          text: `Backup saved (${data.items} items).`,
          path: data.path,
        });
      } else {
        // Web: trigger a browser download.
        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") ?? "";
        const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? "linkstash-backup.zip";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setToast({ kind: "ok", text: `Saved ${name} to your Downloads folder.` });
      }
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : "Backup failed." });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("restore");
    setToast(null);
    setProgress({ label: "Restoring your library…", value: null });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/backup/restore", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Restore failed (HTTP ${res.status})`);
      setToast({ kind: "ok", text: `Restored ${data.restored} of ${data.total} items into your library.` });
      router.refresh();
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Restore failed." });
    } finally {
      setBusy(null);
      setProgress(null);
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      {/* Import */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">Import reading</h2>
        <p className="mt-1 text-sm text-muted">
          Bring in a browser or Pocket bookmarks file (<code>.html</code>), a
          plain list of URLs (<code>.txt</code>), or Zotero/Mendeley references
          (<code>.bib</code>). Imported links start unread; the full article is
          fetched the first time you open it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
          >
            Choose a file…
          </button>
          <span className="text-xs text-faint">.html · .txt · .bib</span>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.txt,.bib,text/html,text/plain"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium">…or paste URLs</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={"https://example.com/article\nhttps://another.com/post"}
            className="mt-2 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            onClick={onImportText}
            disabled={busy !== null || !text.trim()}
            className="mt-2 rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50"
          >
            Import pasted URLs
          </button>
        </div>

        {busy === "import" && progress && <Bar {...progress} />}
      </section>

      {/* Backup */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">Backup &amp; restore</h2>
        <p className="mt-1 text-sm text-muted">
          Download your whole library — items, highlights, notes, collections,
          and uploaded files — as a single <code>.zip</code>. It&apos;s yours:
          keep it as a backup or move it to another machine.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={onBackup}
            disabled={busy !== null}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
          >
            {busy === "backup" ? "Preparing…" : "⬇ Download backup"}
          </button>
          <button
            onClick={() => restoreRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-60"
          >
            Restore from backup…
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept=".zip,application/zip"
            onChange={onRestore}
            className="hidden"
          />
        </div>
        <p className="mt-3 text-xs text-faint">
          Restoring merges the backup into your current library (it never
          deletes what&apos;s already here).
        </p>

        {(busy === "backup" || busy === "restore") && progress && <Bar {...progress} />}
      </section>

      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[90] max-w-sm">
            <div
              className={`rounded-xl border p-4 shadow-xl ${
                toast.kind === "ok"
                  ? "border-line bg-surface"
                  : "border-red-500/40 bg-surface"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none">
                  {toast.kind === "ok" ? "✅" : "⚠️"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">{toast.text}</p>
                  {toast.path && (
                    <div className="mt-2">
                      <p className="mb-1 text-xs text-faint">Saved to</p>
                      <code className="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-line bg-bg px-2 py-1 text-xs text-muted">
                        {toast.path}
                      </code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(toast.path!)}
                        className="mt-2 text-xs text-accent hover:underline"
                      >
                        Copy path
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setToast(null)}
                  aria-label="Dismiss"
                  className="text-muted hover:text-fg"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {value !== null && <span className="tabular-nums">{value}%</span>}
      </div>
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${
          value === null ? "ls-indeterminate" : ""
        }`}
      >
        {value !== null && (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${value}%` }}
          />
        )}
      </div>
    </div>
  );
}
