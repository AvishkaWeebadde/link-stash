"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";
import { writeUpload } from "@/lib/storage";
import type { SaveState } from "@/app/actions/items";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED: Record<string, "pdf" | "epub"> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

export async function uploadFile(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { userId } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File is too large (max 50 MB)." };
  }

  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  let type = ACCEPTED[file.type];
  if (!type) {
    if (ext === "pdf") type = "pdf";
    else if (ext === "epub") type = "epub";
  }
  if (!type) {
    return { error: "Only PDF and EPUB files are supported." };
  }

  const title = name.replace(/\.(pdf|epub)$/i, "").trim() || "Untitled";

  const item = await db.item.create({
    data: { userId, type, title, status: "reading" },
    select: { id: true },
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const relPath = await writeUpload(userId, item.id, ext, buffer);
    await db.item.update({ where: { id: item.id }, data: { filePath: relPath } });
  } catch {
    await db.item.delete({ where: { id: item.id } });
    return { error: "Failed to store the file." };
  }

  await indexItem(item.id, userId, title, title);
  revalidatePath("/library");
  redirect(`/read/${item.id}`);
}
