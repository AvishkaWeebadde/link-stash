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
 * Streams newline-delimited JSON progress so the UI can show a real progress
 * bar: one {type:"start",total} line, periodic {type:"progress",done} lines,
 * then a final {type:"done",imported,skipped,total,kind}.
 */
export async function POST(req: Request) {
  const { userId } = await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  const filename =
    (file instanceof File ? file.name : (form.get("filename") as string)) || "list.txt";
  const content =
    file instanceof File ? await file.text() : (form.get("text") as string) || "";

  const kind = detectKind(filename, content);
  let links = content.trim() ? parseImport(filename, content) : [];

  // De-duplicate within the batch (first occurrence wins).
  const seen = new Set<string>();
  links = links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
  const capped = links.slice(0, MAX_LINKS);

  // Skip links already in the library.
  const existing = capped.length
    ? await db.item.findMany({
        where: { userId, url: { in: capped.map((l) => l.url) } },
        select: { url: true },
      })
    : [];
  const have = new Set(existing.map((e) => e.url));
  const fresh = capped.filter((l) => !have.has(l.url));

  // Upsert every referenced tag once, keyed by name.
  const tagNames = [
    ...new Set(
      fresh.flatMap((l) => l.tags).map((t) => t.toLowerCase().slice(0, 40)).filter(Boolean),
    ),
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      send({ type: "start", total: fresh.length, kind });

      let imported = 0;
      for (let i = 0; i < fresh.length; i++) {
        const link = fresh[i];
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
          await indexItem(item.id, userId, link.title, "");
          imported++;
        } catch {
          // Skip anything that fails to insert rather than aborting the run.
        }
        if (i % 5 === 0 || i === fresh.length - 1) {
          send({ type: "progress", done: i + 1, imported });
        }
      }

      send({
        type: "done",
        imported,
        skipped: capped.length - imported,
        total: capped.length,
        kind,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
