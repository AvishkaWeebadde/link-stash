"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

const TAG_PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

async function assertOwnsItem(userId: string, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) throw new Error("Not found");
}

/** Add a tag to an item, creating the tag for this user if needed. */
export async function addTag(itemId: string, rawName: string) {
  const { userId } = await requireUser();
  await assertOwnsItem(userId, itemId);

  const name = rawName.trim().toLowerCase().slice(0, 40);
  if (!name) return;

  const tag = await db.tag.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, color: colorFor(name) },
    update: {},
    select: { id: true },
  });

  await db.item.update({
    where: { id: itemId },
    data: { tags: { connect: { id: tag.id } } },
  });

  revalidatePath(`/read/${itemId}`);
  revalidatePath("/library");
}

export async function removeTag(itemId: string, tagId: string) {
  const { userId } = await requireUser();
  await assertOwnsItem(userId, itemId);
  await db.item.update({
    where: { id: itemId },
    data: { tags: { disconnect: { id: tagId } } },
  });
  revalidatePath(`/read/${itemId}`);
  revalidatePath("/library");
}

/** Create a collection (idempotent by name for this user). */
export async function createCollection(rawName: string): Promise<string> {
  const { userId } = await requireUser();
  const name = rawName.trim().slice(0, 60);
  if (!name) throw new Error("Name required");
  const c = await db.collection.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
    select: { id: true },
  });
  revalidatePath("/library");
  return c.id;
}

export async function toggleItemInCollection(
  itemId: string,
  collectionId: string,
  add: boolean,
) {
  const { userId } = await requireUser();
  await assertOwnsItem(userId, itemId);
  const owns = await db.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });
  if (!owns) throw new Error("Not found");

  await db.item.update({
    where: { id: itemId },
    data: {
      collections: add
        ? { connect: { id: collectionId } }
        : { disconnect: { id: collectionId } },
    },
  });
  revalidatePath(`/read/${itemId}`);
  revalidatePath("/library");
}
