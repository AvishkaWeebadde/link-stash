import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { db } from "@/lib/db";
import { indexItem } from "@/lib/search";
import { readUpload, writeUpload } from "@/lib/storage";
import { ensureItemColumns } from "@/lib/items";

/*
  Shared-folder sync (v1) — additive and non-destructive.

  Each device writes an encrypted snapshot of its library to a folder the user
  keeps in sync themselves (Dropbox/OneDrive/Syncthing/…), and merges in the
  snapshots other devices left there. Merging only ever ADDS — new items and new
  highlights/notes/bookmarks flow both ways, blank fields get filled, and
  status/progress/favorite follow the most recent edit. Nothing is deleted, so
  the worst case is a duplicate or a stale flag, never a lost annotation.

    <folder>/
      devices/<deviceId>.json.enc   one snapshot per device (encrypted)
      files/<syncId>.<ext>.enc      uploaded PDFs/EPUBs (encrypted, immutable)

  Items are matched across devices by a stable `syncId` (and, for links, by URL
  as a fallback so the same page added on two devices doesn't duplicate).
*/

const DATA_DIR = process.env.LINKSTASH_DATA_DIR || process.cwd();
const CONFIG_PATH = path.join(DATA_DIR, "sync.json");

export type SyncConfig = {
  enabled: boolean;
  folder: string;
  passphrase: string;
  deviceId: string;
  lastSyncAt: string | null;
};

export type PublicSyncConfig = {
  enabled: boolean;
  folder: string;
  hasPassphrase: boolean;
  deviceId: string;
  lastSyncAt: string | null;
};

export type SyncStats = {
  devices: number;
  itemsAdded: number;
  itemsUpdated: number;
  highlightsAdded: number;
  notesAdded: number;
  bookmarksAdded: number;
};

async function readConfig(): Promise<SyncConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
    return {
      enabled: !!raw.enabled,
      folder: raw.folder ?? "",
      passphrase: raw.passphrase ?? "",
      deviceId: raw.deviceId || randomUUID(),
      lastSyncAt: raw.lastSyncAt ?? null,
    };
  } catch {
    return { enabled: false, folder: "", passphrase: "", deviceId: randomUUID(), lastSyncAt: null };
  }
}

async function writeConfig(cfg: SyncConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export async function getPublicConfig(): Promise<PublicSyncConfig> {
  const c = await readConfig();
  // Persist the generated deviceId on first read.
  if (!existsSync(CONFIG_PATH)) await writeConfig(c);
  return {
    enabled: c.enabled,
    folder: c.folder,
    hasPassphrase: !!c.passphrase,
    deviceId: c.deviceId,
    lastSyncAt: c.lastSyncAt,
  };
}

export async function updateConfig(patch: {
  enabled?: boolean;
  folder?: string;
  passphrase?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await readConfig();
  if (patch.folder !== undefined) c.folder = patch.folder.trim();
  if (patch.passphrase) c.passphrase = patch.passphrase;
  if (patch.enabled !== undefined) c.enabled = patch.enabled;

  if (c.enabled) {
    if (!c.folder) return { ok: false, error: "Choose a sync folder first." };
    if (!c.passphrase) return { ok: false, error: "Set a passphrase first." };
    try {
      await fs.mkdir(c.folder, { recursive: true });
      await fs.access(c.folder);
    } catch {
      return { ok: false, error: "That folder doesn't exist or isn't writable." };
    }
  }
  await writeConfig(c);
  return { ok: true };
}

// ---- encryption: aes-256-gcm, key = scrypt(passphrase, per-blob salt) ----
// Layout: [salt(16)][iv(12)][tag(16)][ciphertext].

function encrypt(buf: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const key = scryptSync(passphrase, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), ct]);
}

function decrypt(blob: Buffer, passphrase: string): Buffer {
  const salt = blob.subarray(0, 16);
  const iv = blob.subarray(16, 28);
  const tag = blob.subarray(28, 44);
  const ct = blob.subarray(44);
  const key = scryptSync(passphrase, salt, 32);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

type SnapItem = {
  syncId: string;
  type: string;
  status: string;
  favorite: boolean;
  title: string;
  url: string | null;
  author: string | null;
  siteName: string | null;
  excerpt: string | null;
  lang: string | null;
  contentHtml: string | null;
  textContent: string | null;
  wordCount: number | null;
  ocrData: string | null;
  coverImage: string | null;
  progress: number;
  locator: string | null;
  savedAt: string;
  updatedAt: string;
  fileExt: string | null;
  tags: { name: string; color: string }[];
  collections: { name: string; description: string | null }[];
  highlights: { text: string; note: string | null; color: string; locator: string | null }[];
  notes: { body: string; createdAt: string }[];
  bookmarks: { locator: string; label: string | null; createdAt: string }[];
};

/** Give every not-yet-synced item a stable id. */
async function backfillSyncIds(userId: string) {
  const missing = await db.item.findMany({ where: { userId, syncId: null }, select: { id: true } });
  for (const m of missing) {
    await db.item.update({ where: { id: m.id }, data: { syncId: randomUUID() } });
  }
}

export async function runSync(userId: string): Promise<SyncStats> {
  const cfg = await readConfig();
  if (!cfg.enabled) throw new Error("Sync is off.");
  if (!cfg.folder) throw new Error("No sync folder set.");
  if (!cfg.passphrase) throw new Error("No passphrase set.");

  await ensureItemColumns();
  await backfillSyncIds(userId);

  const devicesDir = path.join(cfg.folder, "devices");
  const filesDir = path.join(cfg.folder, "files");
  await fs.mkdir(devicesDir, { recursive: true });
  await fs.mkdir(filesDir, { recursive: true });

  // ---- PUSH: write this device's snapshot + any new files ----
  const local = await db.item.findMany({
    where: { userId },
    include: {
      tags: { select: { name: true, color: true } },
      collections: { select: { name: true, description: true } },
      highlights: { select: { text: true, note: true, color: true, locator: true } },
      notes: { select: { body: true, createdAt: true } },
      bookmarks: { select: { locator: true, label: true, createdAt: true } },
    },
  });

  const snapItems: SnapItem[] = [];
  for (const it of local) {
    if (!it.syncId) continue;
    let fileExt: string | null = null;
    if (it.filePath) {
      fileExt = it.filePath.split(".").pop() ?? "bin";
      const dest = path.join(filesDir, `${it.syncId}.${fileExt}.enc`);
      if (!existsSync(dest)) {
        try {
          const bytes = await readUpload(it.filePath);
          await fs.writeFile(dest, encrypt(bytes, cfg.passphrase));
        } catch {
          fileExt = null; // file missing on disk
        }
      }
    }
    snapItems.push({
      syncId: it.syncId,
      type: it.type,
      status: it.status,
      favorite: it.favorite,
      title: it.title,
      url: it.url,
      author: it.author,
      siteName: it.siteName,
      excerpt: it.excerpt,
      lang: it.lang,
      contentHtml: it.contentHtml,
      textContent: it.textContent,
      wordCount: it.wordCount,
      ocrData: it.ocrData,
      coverImage: it.coverImage,
      progress: it.progress,
      locator: it.locator,
      savedAt: it.savedAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
      fileExt,
      tags: it.tags,
      collections: it.collections,
      highlights: it.highlights,
      notes: it.notes.map((n) => ({ body: n.body, createdAt: n.createdAt.toISOString() })),
      bookmarks: it.bookmarks.map((b) => ({
        locator: b.locator,
        label: b.label,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  }

  const snapshot = { device: cfg.deviceId, writtenAt: new Date().toISOString(), items: snapItems };
  const tmp = path.join(devicesDir, `${cfg.deviceId}.json.enc.tmp`);
  const dest = path.join(devicesDir, `${cfg.deviceId}.json.enc`);
  await fs.writeFile(tmp, encrypt(Buffer.from(JSON.stringify(snapshot)), cfg.passphrase));
  await fs.rename(tmp, dest);

  // ---- PULL: merge every other device's snapshot ----
  const stats: SyncStats = {
    devices: 0,
    itemsAdded: 0,
    itemsUpdated: 0,
    highlightsAdded: 0,
    notesAdded: 0,
    bookmarksAdded: 0,
  };

  const entries = await fs.readdir(devicesDir).catch(() => [] as string[]);
  for (const name of entries) {
    if (!name.endsWith(".json.enc") || name === `${cfg.deviceId}.json.enc`) continue;
    let remote: { items: SnapItem[] };
    try {
      const blob = await fs.readFile(path.join(devicesDir, name));
      remote = JSON.parse(decrypt(blob, cfg.passphrase).toString("utf8"));
    } catch {
      continue; // wrong passphrase or corrupt snapshot — skip this device
    }
    stats.devices++;
    for (const ri of remote.items ?? []) {
      try {
        await mergeItem(userId, ri, cfg.passphrase, filesDir, stats);
      } catch {
        // Skip a bad entry rather than abort the whole sync.
      }
    }
  }

  cfg.lastSyncAt = new Date().toISOString();
  await writeConfig(cfg);
  return stats;
}

const tagCache = new Map<string, string>();
const colCache = new Map<string, string>();

async function tagIdFor(userId: string, name: string, color: string) {
  const key = `${userId}:${name.toLowerCase()}`;
  if (tagCache.has(key)) return tagCache.get(key)!;
  const t = await db.tag.upsert({
    where: { userId_name: { userId, name: name.toLowerCase() } },
    create: { userId, name: name.toLowerCase(), color },
    update: {},
    select: { id: true },
  });
  tagCache.set(key, t.id);
  return t.id;
}

async function colIdFor(userId: string, name: string, description: string | null) {
  const key = `${userId}:${name}`;
  if (colCache.has(key)) return colCache.get(key)!;
  const existing = await db.collection.findFirst({ where: { userId, name }, select: { id: true } });
  const c =
    existing ??
    (await db.collection.create({ data: { userId, name, description }, select: { id: true } }));
  colCache.set(key, c.id);
  return c.id;
}

async function mergeItem(
  userId: string,
  ri: SnapItem,
  passphrase: string,
  filesDir: string,
  stats: SyncStats,
) {
  // Match by syncId, then (for links) by URL so the same page added on two
  // devices doesn't duplicate; adopt the remote syncId when we do.
  let local = await db.item.findFirst({ where: { userId, syncId: ri.syncId } });
  if (!local && ri.url) {
    const byUrl = await db.item.findFirst({ where: { userId, url: ri.url } });
    if (byUrl) {
      local = byUrl;
      if (!byUrl.syncId) {
        await db.item.update({ where: { id: byUrl.id }, data: { syncId: ri.syncId } });
      }
    }
  }

  const tagConnect = [];
  for (const t of ri.tags) tagConnect.push({ id: await tagIdFor(userId, t.name, t.color) });
  const colConnect = [];
  for (const c of ri.collections) colConnect.push({ id: await colIdFor(userId, c.name, c.description) });

  if (!local) {
    const created = await db.item.create({
      data: {
        userId,
        syncId: ri.syncId,
        type: ri.type,
        status: ri.status,
        favorite: ri.favorite,
        title: ri.title,
        url: ri.url,
        author: ri.author,
        siteName: ri.siteName,
        excerpt: ri.excerpt,
        lang: ri.lang,
        contentHtml: ri.contentHtml,
        textContent: ri.textContent,
        wordCount: ri.wordCount,
        ocrData: ri.ocrData,
        coverImage: ri.coverImage,
        progress: ri.progress,
        locator: ri.locator,
        savedAt: ri.savedAt ? new Date(ri.savedAt) : undefined,
        tags: tagConnect.length ? { connect: tagConnect } : undefined,
        collections: colConnect.length ? { connect: colConnect } : undefined,
        highlights: ri.highlights.length
          ? { create: ri.highlights.map((h) => ({ userId, text: h.text, note: h.note, color: h.color, locator: h.locator })) }
          : undefined,
        notes: ri.notes.length
          ? { create: ri.notes.map((n) => ({ userId, body: n.body, createdAt: new Date(n.createdAt) })) }
          : undefined,
        bookmarks: ri.bookmarks.length
          ? { create: ri.bookmarks.map((b) => ({ userId, locator: b.locator, label: b.label, createdAt: new Date(b.createdAt) })) }
          : undefined,
      },
      select: { id: true },
    });

    if (ri.fileExt) {
      const src = path.join(filesDir, `${ri.syncId}.${ri.fileExt}.enc`);
      if (existsSync(src)) {
        try {
          const bytes = decrypt(await fs.readFile(src), passphrase);
          const rel = await writeUpload(userId, created.id, ri.fileExt, bytes);
          await db.item.update({ where: { id: created.id }, data: { filePath: rel } });
        } catch {
          /* couldn't restore file — item still imported */
        }
      }
    }

    await indexItem(created.id, userId, ri.title, ri.textContent ?? "");
    stats.itemsAdded++;
    return;
  }

  // Existing item: fill blanks, take newest scalar edits, add missing annotations.
  const remoteNewer = new Date(ri.updatedAt).getTime() > local.updatedAt.getTime();
  const patch: Record<string, unknown> = {};
  if (remoteNewer) {
    patch.status = ri.status;
    patch.progress = ri.progress;
    patch.favorite = ri.favorite;
    if (ri.locator) patch.locator = ri.locator;
  }
  let reindex = false;
  if (!local.contentHtml && ri.contentHtml) {
    patch.contentHtml = ri.contentHtml;
    patch.textContent = ri.textContent;
    patch.wordCount = ri.wordCount;
    patch.excerpt = local.excerpt ?? ri.excerpt;
    patch.author = local.author ?? ri.author;
    patch.siteName = local.siteName ?? ri.siteName;
    patch.coverImage = local.coverImage ?? ri.coverImage;
    reindex = true;
  }
  if (!local.ocrData && ri.ocrData) patch.ocrData = ri.ocrData;
  if (Object.keys(patch).length) {
    await db.item.update({ where: { id: local.id }, data: patch });
    stats.itemsUpdated++;
  }
  if (tagConnect.length || colConnect.length) {
    await db.item.update({
      where: { id: local.id },
      data: {
        tags: tagConnect.length ? { connect: tagConnect } : undefined,
        collections: colConnect.length ? { connect: colConnect } : undefined,
      },
    });
  }

  // Additive annotation merge (dedup by content key).
  const [locHl, locNo, locBm] = await Promise.all([
    db.highlight.findMany({ where: { itemId: local.id }, select: { text: true, locator: true } }),
    db.note.findMany({ where: { itemId: local.id }, select: { body: true } }),
    db.bookmark.findMany({ where: { itemId: local.id }, select: { locator: true, label: true } }),
  ]);
  const hlKeys = new Set(locHl.map((h) => `${h.locator}|${h.text}`));
  const noKeys = new Set(locNo.map((n) => n.body));
  const bmKeys = new Set(locBm.map((b) => `${b.locator}|${b.label}`));

  for (const h of ri.highlights) {
    if (hlKeys.has(`${h.locator}|${h.text}`)) continue;
    await db.highlight.create({
      data: { userId, itemId: local.id, text: h.text, note: h.note, color: h.color, locator: h.locator },
    });
    stats.highlightsAdded++;
  }
  for (const n of ri.notes) {
    if (noKeys.has(n.body)) continue;
    await db.note.create({ data: { userId, itemId: local.id, body: n.body, createdAt: new Date(n.createdAt) } });
    stats.notesAdded++;
  }
  for (const b of ri.bookmarks) {
    if (bmKeys.has(`${b.locator}|${b.label}`)) continue;
    await db.bookmark.create({
      data: { userId, itemId: local.id, locator: b.locator, label: b.label, createdAt: new Date(b.createdAt) },
    });
    stats.bookmarksAdded++;
  }

  if (reindex) {
    await indexItem(local.id, userId, local.title, ri.textContent ?? local.textContent ?? "");
  }
}
