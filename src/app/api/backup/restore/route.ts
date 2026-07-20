import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";
import { writeUpload } from "@/lib/storage";

/**
 * Restore a library from a backup .zip produced by /api/backup/export.
 * Everything is recreated for the current user with fresh ids and merged into
 * the existing library (never a destructive replace). Tags and collections are
 * matched by name so a restore doesn't duplicate them.
 */
export async function POST(req: Request) {
  const { userId } = await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No backup file." }, { status: 400 });
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "That isn't a valid .zip." }, { status: 400 });
  }
  const manifest = zip.file("library.json");
  if (!manifest) {
    return NextResponse.json(
      { error: "Not a LinkStash backup (no library.json)." },
      { status: 400 },
    );
  }

  let data: { items?: RawItem[] };
  try {
    data = JSON.parse(await manifest.async("string"));
  } catch {
    return NextResponse.json({ error: "Corrupt library.json." }, { status: 400 });
  }
  const items = Array.isArray(data.items) ? data.items : [];

  const tagCache = new Map<string, string>();
  const colCache = new Map<string, string>();

  async function tagIdFor(name: string, color?: string) {
    const key = name.toLowerCase();
    if (tagCache.has(key)) return tagCache.get(key)!;
    const t = await db.tag.upsert({
      where: { userId_name: { userId, name: key } },
      create: { userId, name: key, ...(color ? { color } : {}) },
      update: {},
      select: { id: true },
    });
    tagCache.set(key, t.id);
    return t.id;
  }
  async function colIdFor(name: string, description?: string | null) {
    if (colCache.has(name)) return colCache.get(name)!;
    const existing = await db.collection.findFirst({
      where: { userId, name },
      select: { id: true },
    });
    const c =
      existing ??
      (await db.collection.create({
        data: { userId, name, description: description ?? null },
        select: { id: true },
      }));
    colCache.set(name, c.id);
    return c.id;
  }

  let restored = 0;
  for (const it of items) {
    try {
      const tagConnect = [];
      for (const t of it.tags ?? []) tagConnect.push({ id: await tagIdFor(t.name, t.color) });
      const colConnect = [];
      for (const c of it.collections ?? [])
        colConnect.push({ id: await colIdFor(c.name, c.description) });

      const created = await db.item.create({
        data: {
          userId,
          type: it.type ?? "article",
          status: it.status ?? "unread",
          favorite: !!it.favorite,
          title: it.title ?? "Untitled",
          url: it.url ?? null,
          author: it.author ?? null,
          siteName: it.siteName ?? null,
          excerpt: it.excerpt ?? null,
          lang: it.lang ?? null,
          contentHtml: it.contentHtml ?? null,
          textContent: it.textContent ?? null,
          wordCount: it.wordCount ?? null,
          ocrData: it.ocrData ?? null,
          coverImage: it.coverImage ?? null,
          progress: it.progress ?? 0,
          locator: it.locator ?? null,
          savedAt: it.savedAt ? new Date(it.savedAt) : undefined,
          tags: tagConnect.length ? { connect: tagConnect } : undefined,
          collections: colConnect.length ? { connect: colConnect } : undefined,
          highlights: it.highlights?.length
            ? {
                create: it.highlights.map((h) => ({
                  userId,
                  text: h.text,
                  note: h.note ?? null,
                  color: h.color ?? "yellow",
                  locator: h.locator ?? null,
                })),
              }
            : undefined,
          notes: it.notes?.length
            ? {
                create: it.notes.map((n) => ({
                  userId,
                  body: n.body,
                  ...(n.createdAt ? { createdAt: new Date(n.createdAt) } : {}),
                })),
              }
            : undefined,
          bookmarks: it.bookmarks?.length
            ? {
                create: it.bookmarks.map((b) => ({
                  userId,
                  locator: b.locator,
                  label: b.label ?? null,
                  ...(b.createdAt ? { createdAt: new Date(b.createdAt) } : {}),
                })),
              }
            : undefined,
        },
        select: { id: true },
      });

      // Restore the uploaded file under a fresh path for the new item id.
      if (it.filePath) {
        const entry = zip.file(`files/${it.filePath}`);
        if (entry) {
          const buf = Buffer.from(await entry.async("nodebuffer"));
          const ext = it.filePath.split(".").pop() || "bin";
          const newPath = await writeUpload(userId, created.id, ext, buf);
          await db.item.update({ where: { id: created.id }, data: { filePath: newPath } });
        }
      }

      await indexItem(created.id, userId, it.title ?? "", it.textContent ?? "");
      restored++;
    } catch {
      // Skip a bad entry rather than abort the whole restore.
    }
  }

  return NextResponse.json({ restored, total: items.length });
}

type RawItem = {
  type?: string;
  status?: string;
  favorite?: boolean;
  title?: string;
  url?: string | null;
  author?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  lang?: string | null;
  contentHtml?: string | null;
  textContent?: string | null;
  wordCount?: number | null;
  ocrData?: string | null;
  coverImage?: string | null;
  filePath?: string | null;
  progress?: number;
  locator?: string | null;
  savedAt?: string;
  tags?: { name: string; color?: string }[];
  collections?: { name: string; description?: string | null }[];
  highlights?: { text: string; note?: string | null; color?: string; locator?: string | null }[];
  notes?: { body: string; createdAt?: string }[];
  bookmarks?: { locator: string; label?: string | null; createdAt?: string }[];
};
