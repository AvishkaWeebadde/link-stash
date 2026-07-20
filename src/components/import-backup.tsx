"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = { imported: number; skipped: number; total: number; kind: string };
type RestoreResult = { restored: number; total: number };

const KIND_LABEL: Record<string, string> = {
  bookmarks: "bookmarks",
  urls: "URL list",
  bibtex: "BibTeX references",
};

export default function ImportBackup() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "import" | "restore">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function runImport(body: FormData) {
    setBusy("import");
    setMsg(null);
    try {
      const res = await fetch("/api/import", { method: "POST", body });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Import failed (HTTP ${res.status})`);
      const label = KIND_LABEL[data.kind] ?? "links";
      setMsg({
        kind: "ok",
        text:
          data.imported > 0
            ? `Imported ${data.imported} ${label}${data.skipped ? `, skipped ${data.skipped} already in your library` : ""}. Open one to fetch its full text.`
            : `Nothing new to import — all ${data.total} were already in your library.`,
      });
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Import failed." });
    } finally {
      setBusy(null);
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

  async function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("restore");
    setMsg(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/backup/restore", { method: "POST", body });
      const data = (await res.json()) as RestoreResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Restore failed (HTTP ${res.status})`);
      setMsg({ kind: "ok", text: `Restored ${data.restored} of ${data.total} items into your library.` });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Restore failed." });
    } finally {
      setBusy(null);
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.kind === "ok"
              ? "border-accent/40 bg-accent-soft text-fg"
              : "border-red-500/40 bg-red-500/10 text-red-500"
          }`}
        >
          {msg.text}
        </div>
      )}

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
            {busy === "import" ? "Importing…" : "Choose a file…"}
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
          <a
            href="/api/backup/export"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            ⬇ Download backup
          </a>
          <button
            onClick={() => restoreRef.current?.click()}
            disabled={busy !== null}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-60"
          >
            {busy === "restore" ? "Restoring…" : "Restore from backup…"}
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
      </section>
    </div>
  );
}
