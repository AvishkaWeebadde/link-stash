"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { extractArticle, sanitizeHtml } from "@/lib/extract";
import { indexItem, removeFromIndex } from "@/lib/search";
import { deleteUpload } from "@/lib/storage";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import { NoteSchema, SaveUrlSchema } from "@/lib/validation";

export type SaveState = { error?: string } | undefined;

/** Save a web article: fetch → extract → sanitize → store, then open it. */
export async function saveArticle(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { userId } = await requireUser();

  const parsed = SaveUrlSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid URL." };
  }

  let article;
  try {
    article = await extractArticle(parsed.data.url);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save this page.",
    };
  }

  const item = await db.item.create({
    data: {
      userId,
      type: "article",
      url: parsed.data.url,
      title: article.title,
      author: article.author,
      siteName: article.siteName,
      excerpt: article.excerpt,
      lang: article.lang,
      contentHtml: article.contentHtml,
      textContent: article.textContent,
      wordCount: article.wordCount,
      coverImage: article.coverImage,
    },
    select: { id: true },
  });

  await indexItem(item.id, userId, article.title, article.textContent);
  revalidatePath("/library");
  redirect(`/read/${item.id}`);
}

/** Create a standalone note. */
export async function createNote(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { userId } = await requireUser();

  const parsed = NoteSchema.safeParse({
    title: formData.get("title"),
    contentHtml: formData.get("contentHtml") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid note." };
  }

  const cleanHtml = parsed.data.contentHtml
    ? sanitizeHtml(parsed.data.contentHtml)
    : "";
  const text = cleanHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const item = await db.item.create({
    data: {
      userId,
      type: "note",
      title: parsed.data.title,
      contentHtml: cleanHtml,
      textContent: text,
      wordCount: text ? text.split(/\s+/).length : 0,
      status: "reading",
    },
    select: { id: true },
  });

  await indexItem(item.id, userId, parsed.data.title, text);
  revalidatePath("/library");
  redirect(`/read/${item.id}`);
}

async function ownItem(userId: string, id: string) {
  const item = await db.item.findFirst({ where: { id, userId }, select: { id: true } });
  if (!item) throw new Error("Not found");
  return item;
}

export async function toggleFavorite(id: string) {
  const { userId } = await requireUser();
  await ownItem(userId, id);
  const item = await db.item.findUnique({ where: { id }, select: { favorite: true } });
  await db.item.update({
    where: { id },
    data: { favorite: !item?.favorite },
  });
  revalidatePath("/library");
  revalidatePath(`/read/${id}`);
}

export async function setStatus(id: string, status: ItemStatus) {
  const { userId } = await requireUser();
  await ownItem(userId, id);
  if (!ITEM_STATUSES.includes(status)) throw new Error("Invalid status");
  await db.item.update({ where: { id }, data: { status } });
  revalidatePath("/library");
  revalidatePath(`/read/${id}`);
}

/** Persist reading progress for a book/PDF. Called frequently by the reader. */
export async function updateProgress(
  id: string,
  progress: number,
  locator: string,
) {
  const { userId } = await requireUser();
  await ownItem(userId, id);
  const clamped = Math.max(0, Math.min(1, progress));
  await db.item.update({
    where: { id },
    data: {
      progress: clamped,
      locator,
      status: clamped >= 0.98 ? "archived" : "reading",
    },
  });
  // Intentionally no revalidate: avoids reloading the reader mid-scroll.
}

export async function deleteItem(id: string) {
  const { userId } = await requireUser();
  const item = await db.item.findFirst({
    where: { id, userId },
    select: { id: true, filePath: true },
  });
  if (!item) throw new Error("Not found");

  await db.item.delete({ where: { id } });
  await removeFromIndex(id);
  if (item.filePath) await deleteUpload(item.filePath);

  revalidatePath("/library");
  redirect("/library");
}
