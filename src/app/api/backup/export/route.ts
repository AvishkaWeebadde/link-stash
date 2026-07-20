import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { readUpload } from "@/lib/storage";
import { IS_LOCAL } from "@/lib/mode";

/**
 * Export the current user's entire library as a portable .zip:
 *   library.json   every item + its tags, collections, highlights, notes,
 *                  bookmarks (user-scoped, so it's safe in multi-user mode).
 *   files/…        the original uploaded PDFs/EPUBs, keyed by their stored path.
 * Restored via /api/backup/restore. No lock-in — it's your data, take it.
 */
export async function GET() {
  const { userId } = await requireUser();

  const items = await db.item.findMany({
    where: { userId },
    include: {
      tags: { select: { name: true, color: true } },
      collections: { select: { name: true, description: true } },
      highlights: { select: { text: true, note: true, color: true, locator: true } },
      notes: { select: { body: true, createdAt: true } },
      bookmarks: { select: { locator: true, label: true, createdAt: true } },
    },
    orderBy: { savedAt: "asc" },
  });

  const zip = new JSZip();
  const exported = [];
  for (const it of items) {
    if (it.filePath) {
      try {
        zip.file(`files/${it.filePath}`, await readUpload(it.filePath));
      } catch {
        // Missing file on disk — export the metadata anyway.
      }
    }
    const { id, userId: _u, ...rest } = it;
    void id;
    void _u;
    exported.push(rest);
  }

  zip.file(
    "library.json",
    JSON.stringify(
      {
        linkstash: {
          backup: 1,
          app: process.env.npm_package_version ?? null,
          exportedAt: new Date().toISOString(),
          items: exported.length,
        },
        items: exported,
      },
      null,
      2,
    ),
  );

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `linkstash-backup-${stamp}.zip`;

  // On the desktop the server runs on your own machine, so write the backup
  // straight to your Downloads folder and hand back the exact path to show.
  // In hosted/web mode there's no user filesystem, so stream it as a download.
  if (IS_LOCAL) {
    const downloads = path.join(os.homedir(), "Downloads");
    const dir = existsSync(downloads) ? downloads : os.homedir();
    const dest = path.join(dir, filename);
    await fs.writeFile(dest, buf);
    return NextResponse.json({ saved: true, path: dest, filename, items: exported.length });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
