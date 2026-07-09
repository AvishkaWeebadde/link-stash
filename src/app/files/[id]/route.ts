import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { readUpload } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
};

// Serve an uploaded file, scoped to its owner.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/files/[id]">,
) {
  const { userId } = await requireUser();
  const { id } = await ctx.params;

  const item = await db.item.findFirst({
    where: { id, userId },
    select: { filePath: true, type: true, title: true },
  });
  if (!item?.filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readUpload(item.filePath);
    const body = new Uint8Array(data);
    return new Response(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[item.type] ?? "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
