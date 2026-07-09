import "server-only";
import path from "node:path";
import fs from "node:fs/promises";

// Uploaded files live under <project root>/uploads/<userId>/<itemId>.<ext>.
// This directory is gitignored; configure a volume for it when self-hosting.
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export function uploadPathFor(
  userId: string,
  itemId: string,
  ext: string,
): string {
  return path.join(UPLOADS_ROOT, userId, `${itemId}.${ext.replace(/^\./, "")}`);
}

export async function writeUpload(
  userId: string,
  itemId: string,
  ext: string,
  data: Buffer,
): Promise<string> {
  const full = uploadPathFor(userId, itemId, ext);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  // Store a path relative to the uploads root so the DB stays portable.
  return path.relative(UPLOADS_ROOT, full).split(path.sep).join("/");
}

export async function readUpload(relPath: string): Promise<Buffer> {
  // Guard against path traversal.
  const full = path.join(UPLOADS_ROOT, relPath);
  const normalized = path.normalize(full);
  if (!normalized.startsWith(UPLOADS_ROOT)) {
    throw new Error("Invalid path");
  }
  return fs.readFile(normalized);
}

export async function deleteUpload(relPath: string): Promise<void> {
  try {
    const full = path.normalize(path.join(UPLOADS_ROOT, relPath));
    if (full.startsWith(UPLOADS_ROOT)) await fs.unlink(full);
  } catch {
    // Missing file is fine.
  }
}
