import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";
import { parseImport, detectKind } from "@/lib/import-parsers";

const MAX_LINKS = 5000;

/**
 * Bulk-import a reading list (browser/Pocket bookmarks, a URL list, or a
 * BibTeX file) as article items. Imported links start unread with no content;
 * the full text is fetched lazily the first time each one is opened.
 *
 * A route handler (not a server action) because it takes a file upload and can
 * return a large-ish result — the same reason /api/ocr is a route.
 */
export async function POST(req: Request) {
  const { userId } = await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  const filename =
    (file instanceof File ? file.name : (form.get("filename") as string)) || "list.txt";
  const content =
    file instanceof File ? await file.text() : (form.get("text") as string) || "";

  if (!content.trim()) {
    return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
  }

  const kind = detectKind(filename, content);
  let links = parseImport(filename, content);

  // De-duplicate within the batch (first occurrence wins).
  const seen = new Set<string>();
  links = links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
  if (links.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, total: 0, kind });
  }
  const capped = links.slice(0, MAX_LINKS);

  // Skip links already in the library.
  const existing = await db.item.findMany({
    where: { userId, url: { in: capped.map((l) => l.url) } },
    select: { url: true },
  });
  const have = new Set(existing.map((e) => e.url));
  const fresh = capped.filter((l) => !have.has(l.url));

  // Upsert every referenced tag once, keyed by name.
  const tagNames = [
    ...new Set(fresh.flatMap((l) => l.tags).map((t) => t.toLowerCase().slice(0, 40)).filter(Boolean)),
  ];
  const tagIds = new Map<string, string>();
  for (const name of tagNames) {
    const tag = await db.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select: { id: true },
    });
    tagIds.set(name, tag.id);
  }

  let imported = 0;
  for (const link of fresh) {
    try {
      const connect = link.tags
        .map((t) => tagIds.get(t.toLowerCase().slice(0, 40)))
        .filter((id): id is string => !!id)
        .map((id) => ({ id }));
      const item = await db.item.create({
        data: {
          userId,
          type: "article",
          status: "unread",
          url: link.url,
          title: link.title.slice(0, 500) || link.url,
          author: link.author?.slice(0, 300) ?? null,
          excerpt: link.excerpt?.slice(0, 500) ?? null,
          tags: connect.length ? { connect } : undefined,
        },
        select: { id: true },
      });
      // Index the title now; the body is added when the article is hydrated.
      await indexItem(item.id, userId, link.title, "");
      imported++;
    } catch {
      // Skip anything that fails to insert rather than aborting the whole run.
    }
  }

  return NextResponse.json({
    imported,
    skipped: capped.length - imported,
    total: capped.length,
    kind,
  });
}
