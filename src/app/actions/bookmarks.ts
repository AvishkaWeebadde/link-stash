"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ensureBookmarkTable } from "@/lib/bookmarks";

async function ownItem(userId: string, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) throw new Error("Not found");
}

export async function addBookmark(
  itemId: string,
  locator: string,
  label?: string,
) {
  const { userId } = await requireUser();
  await ownItem(userId, itemId);
  if (!locator) return;
  await ensureBookmarkTable();
  await db.bookmark.create({
    data: {
      userId,
      itemId,
      locator: locator.slice(0, 2000),
      label: label?.trim() ? label.trim().slice(0, 500) : null,
    },
  });
  revalidatePath(`/read/${itemId}`);
}

export async function updateBookmarkLabel(id: string, label: string) {
  const { userId } = await requireUser();
  await ensureBookmarkTable();
  const bm = await db.bookmark.findFirst({
    where: { id, userId },
    select: { itemId: true },
  });
  if (!bm) throw new Error("Not found");
  await db.bookmark.update({
    where: { id },
    data: { label: label.trim() ? label.trim().slice(0, 500) : null },
  });
  revalidatePath(`/read/${bm.itemId}`);
}

export async function deleteBookmark(id: string) {
  const { userId } = await requireUser();
  await ensureBookmarkTable();
  const bm = await db.bookmark.findFirst({
    where: { id, userId },
    select: { itemId: true },
  });
  if (!bm) throw new Error("Not found");
  await db.bookmark.delete({ where: { id } });
  revalidatePath(`/read/${bm.itemId}`);
}
