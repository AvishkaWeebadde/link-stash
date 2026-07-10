import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { indexItem } from "@/lib/search";
import { ensureItemColumns } from "@/lib/items";

// Save OCR results (recognized text + per-page word boxes) for a scanned PDF.
// Uses a route handler rather than a Server Action so large payloads (a whole
// document's word boxes) transfer reliably.
export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return new Response(null, { status: 401 });

  let body: { itemId?: string; text?: string; ocrData?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const { itemId, text = "", ocrData } = body;
  if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400 });

  await ensureItemColumns();
  const item = await db.item.findFirst({
    where: { id: itemId, userId: session.userId },
    select: { id: true, title: true },
  });
  if (!item) return new Response(null, { status: 404 });

  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2_000_000);
  const words = clean ? clean.split(/\s+/).length : 0;

  await db.item.update({
    where: { id: itemId },
    data: {
      textContent: clean || null,
      wordCount: words || null,
      ocrData: ocrData ? ocrData.slice(0, 8_000_000) : null,
    },
  });
  await indexItem(itemId, session.userId, item.title, `${item.title}\n${clean}`);

  revalidatePath(`/read/${itemId}`);
  revalidatePath("/library");
  return Response.json({ ok: true, words });
}
