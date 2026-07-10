import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { listItemNotes } from "@/lib/notes";

// All annotations for an item in one place: highlights (with their inline
// notes) and standalone item notes. Powers the unified Annotations panel.
export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) return new Response(null, { status: 401 });

  const itemId = request.nextUrl.searchParams.get("itemId") ?? "";
  if (!itemId) return Response.json({ highlights: [], notes: [] });

  const owns = await db.item.findFirst({
    where: { id: itemId, userId: session.userId },
    select: { id: true },
  });
  if (!owns) return new Response(null, { status: 404 });

  const [highlights, notes] = await Promise.all([
    db.highlight.findMany({
      where: { itemId, userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, color: true, note: true, locator: true },
    }),
    listItemNotes(session.userId, itemId),
  ]);

  return Response.json({ highlights, notes });
}
