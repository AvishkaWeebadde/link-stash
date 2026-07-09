"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/constants";

async function assertOwnsItem(userId: string, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) throw new Error("Not found");
}

export async function createHighlight(input: {
  itemId: string;
  text: string;
  locator: string;
  color?: HighlightColor;
  note?: string;
}): Promise<string> {
  const { userId } = await requireUser();
  await assertOwnsItem(userId, input.itemId);

  const color: HighlightColor = HIGHLIGHT_COLORS.includes(
    input.color as HighlightColor,
  )
    ? (input.color as HighlightColor)
    : "yellow";

  const hl = await db.highlight.create({
    data: {
      userId,
      itemId: input.itemId,
      text: input.text.slice(0, 10_000),
      locator: input.locator,
      color,
      note: input.note?.trim() || null,
    },
    select: { id: true },
  });

  revalidatePath(`/read/${input.itemId}`);
  return hl.id;
}

export async function updateHighlightNote(highlightId: string, note: string) {
  const { userId } = await requireUser();
  const hl = await db.highlight.findFirst({
    where: { id: highlightId, userId },
    select: { itemId: true },
  });
  if (!hl) throw new Error("Not found");
  await db.highlight.update({
    where: { id: highlightId },
    data: { note: note.trim() || null },
  });
  revalidatePath(`/read/${hl.itemId}`);
}

export async function deleteHighlight(highlightId: string) {
  const { userId } = await requireUser();
  const hl = await db.highlight.findFirst({
    where: { id: highlightId, userId },
    select: { itemId: true },
  });
  if (!hl) throw new Error("Not found");
  await db.highlight.delete({ where: { id: highlightId } });
  revalidatePath(`/read/${hl.itemId}`);
}
