"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Config = {
  enabled: boolean;
  folder: string;
  hasPassphrase: boolean;
  deviceId: string;
  lastSyncAt: string | null;
};

export default function SyncPanel() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [folder, setFolder] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState<null | "save" | "sync">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/sync/config")
      .then((r) => r.json())
      .then((c: Config) => {
        setCfg(c);
        setFolder(c.folder);
      })
      .catch(() => {});
  }, []);

  async function saveConfig(patch: { enabled?: boolean; folder?: string; passphrase?: string }) {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/sync/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save settings.");
      setCfg(data);
      setPassphrase("");
      setMsg({ kind: "ok", text: "Sync settings saved." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setMsg(null);
    try {
      const res = await fetch("/api/sync/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      const s = data.stats;
      setMsg({
        kind: "ok",
        text: `Synced with ${s.devices} other device${s.devices === 1 ? "" : "s"} · added ${s.itemsAdded} items, ${s.highlightsAdded} highlights, ${s.notesAdded} notes.`,
      });
      const c = await (await fetch("/api/sync/config")).json();
      setCfg(c);
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Sync failed." });
    } finally {
      setBusy(null);
    }
  }

  if (!cfg) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Sync</h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
          beta
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Point LinkStash at a folder that Dropbox, OneDrive, iCloud, or Syncthing
        already keeps in sync. Your library is written there <strong>encrypted</strong>{" "}
        and merged across your devices. Merging only adds — it never deletes.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Sync folder</label>
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="C:\Users\you\Dropbox\LinkStash"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-1 text-xs text-faint">
            Paste the full path to a folder inside your synced drive. It will be created if needed.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">
            Passphrase {cfg.hasPassphrase && <span className="text-xs text-faint">· set</span>}
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={cfg.hasPassphrase ? "•••••••• (unchanged)" : "Encrypts your snapshots"}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-1 text-xs text-faint">
            Use the <strong>same passphrase on every device</strong>. If you lose it, existing
            snapshots can&apos;t be read — there&apos;s no recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => saveConfig({ folder, passphrase: passphrase || undefined })}
            disabled={busy !== null}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50"
          >
            Save settings
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.enabled}
              disabled={busy !== null}
              onChange={(e) => saveConfig({ enabled: e.target.checked })}
            />
            Enable sync
          </label>

          <button
            onClick={syncNow}
            disabled={busy !== null || !cfg.enabled}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
            title={cfg.enabled ? "" : "Enable sync first"}
          >
            {busy === "sync" ? "Syncing…" : "🔄 Sync now"}
          </button>
        </div>

        {cfg.lastSyncAt && (
          <p className="text-xs text-faint">
            Last synced {new Date(cfg.lastSyncAt).toLocaleString()} · this device{" "}
            <code>{cfg.deviceId.slice(0, 8)}</code>
          </p>
        )}

        {msg && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              msg.kind === "ok"
                ? "border-accent/40 bg-accent-soft text-fg"
                : "border-red-500/40 bg-red-500/10 text-red-500"
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </section>
  );
}
