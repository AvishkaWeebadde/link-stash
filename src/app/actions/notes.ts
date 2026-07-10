"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ensureNoteTable } from "@/lib/notes";

async function ownItem(userId: string, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) throw new Error("Not found");
}

export async function addNote(itemId: string, body: string) {
  const { userId } = await requireUser();
  await ownItem(userId, itemId);
  const text = body.trim();
  if (!text) return;
  await ensureNoteTable();
  await db.note.create({ data: { userId, itemId, body: text.slice(0, 20000) } });
  revalidatePath(`/read/${itemId}`);
}

export async function updateNote(id: string, body: string) {
  const { userId } = await requireUser();
  await ensureNoteTable();
  const note = await db.note.findFirst({
    where: { id, userId },
    select: { itemId: true },
  });
  if (!note) throw new Error("Not found");
  await db.note.update({
    where: { id },
    data: { body: body.trim().slice(0, 20000) },
  });
  revalidatePath(`/read/${note.itemId}`);
}

export async function deleteNote(id: string) {
  const { userId } = await requireUser();
  await ensureNoteTable();
  const note = await db.note.findFirst({
    where: { id, userId },
    select: { itemId: true },
  });
  if (!note) throw new Error("Not found");
  await db.note.delete({ where: { id } });
  revalidatePath(`/read/${note.itemId}`);
}
