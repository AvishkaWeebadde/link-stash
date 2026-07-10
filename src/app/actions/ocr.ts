"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";
import { ensureItemColumns } from "@/lib/items";

// Store text recognized from a scanned PDF (OCR runs client-side in the
// reader). This makes the document searchable, read-aloud-able, and — via the
// per-page word boxes in `ocrData` — selectable.
export async function saveOcrText(
  itemId: string,
  text: string,
  ocrData?: string,
) {
  const { userId } = await requireUser();
  await ensureItemColumns();
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true, title: true },
  });
  if (!item) throw new Error("Not found");

  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2_000_000);
  const words = clean ? clean.split(/\s+/).length : 0;

  await db.item.update({
    where: { id: itemId },
    data: {
      textContent: clean || null,
      wordCount: words || null,
      ocrData: ocrData?.slice(0, 8_000_000) || null,
    },
  });
  await indexItem(itemId, userId, item.title, `${item.title}\n${clean}`);

  revalidatePath(`/read/${itemId}`);
  revalidatePath("/library");
}
