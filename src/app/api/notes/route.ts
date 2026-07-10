import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { listItemNotes } from "@/lib/notes";

// Live list of an item's notes, used by the notes panel so it always reflects
// the current database state.
export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) return new Response(null, { status: 401 });

  const itemId = request.nextUrl.searchParams.get("itemId") ?? "";
  if (!itemId) return Response.json({ notes: [] });

  const owns = await db.item.findFirst({
    where: { id: itemId, userId: session.userId },
    select: { id: true },
  });
  if (!owns) return new Response(null, { status: 404 });

  const notes = await listItemNotes(session.userId, itemId);
  return Response.json({ notes });
}
