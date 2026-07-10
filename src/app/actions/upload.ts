"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";
import { writeUpload } from "@/lib/storage";
import { extractPdfText, extractEpubText } from "@/lib/doc-text";
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
  let format = ACCEPTED[file.type];
  if (!format) {
    if (ext === "pdf") format = "pdf";
    else if (ext === "epub") format = "epub";
  }
  if (!format) {
    return { error: "Only PDF and EPUB files are supported." };
  }

  // The user chooses the kind (book vs paper); default from the format
  // (EPUBs are usually books, PDFs usually papers) if not provided.
  const requestedKind = String(formData.get("kind") ?? "");
  const kind: "book" | "paper" =
    requestedKind === "book" || requestedKind === "paper"
      ? requestedKind
      : format === "epub"
        ? "book"
        : "paper";

  const title = name.replace(/\.(pdf|epub)$/i, "").trim() || "Untitled";

  const item = await db.item.create({
    data: { userId, type: kind, title, status: "reading" },
    select: { id: true },
  });

  let extractedText = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const relPath = await writeUpload(userId, item.id, ext, buffer);

    // Pull out the text so the document can be read aloud and searched.
    const extracted =
      format === "pdf"
        ? await extractPdfText(buffer)
        : await extractEpubText(buffer);
    extractedText = extracted.text;

    await db.item.update({
      where: { id: item.id },
      data: {
        filePath: relPath,
        textContent: extracted.text || null,
        wordCount: extracted.words || null,
      },
    });
  } catch {
    await db.item.delete({ where: { id: item.id } });
    return { error: "Failed to store the file." };
  }

  await indexItem(item.id, userId, title, `${title}\n${extractedText}`);
  revalidatePath("/library");
  redirect(`/read/${item.id}`);
}
