import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { indexItem } from "@/lib/search";

/**
 * Save-from-browser endpoint used by the LinkStash browser extension. Creates
 * an unread article from a URL (the full text is fetched lazily on first open,
 * like imports). De-duplicates against the existing library.
 *
 * Security: only extension origins (or requests with no Origin, e.g. curl) are
 * allowed. Real web pages always send an http(s) Origin and are rejected, so a
 * random site can't inject items into the local library via 127.0.0.1.
 */
function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  return res;
}

function originAllowed(origin: string | null): boolean {
  if (!origin) return true; // curl / extension SW without an Origin header
  return /^chrome-extension:\/\/|^moz-extension:\/\/|^safari-web-extension:\/\//.test(origin);
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  if (!originAllowed(req.headers.get("origin"))) {
    return cors(NextResponse.json({ error: "Forbidden origin" }, { status: 403 }));
  }

  const { userId } = await requireUser();
  const body = (await req.json().catch(() => null)) as {
    url?: string;
    title?: string;
    selection?: string;
  } | null;

  const url = (body?.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return cors(NextResponse.json({ error: "A valid URL is required." }, { status: 400 }));
  }
  const title = (body?.title || url).slice(0, 500);
  const selection = (body?.selection ?? "").trim().slice(0, 500);

  const existing = await db.item.findFirst({
    where: { userId, url },
    select: { id: true },
  });
  if (existing) {
    return cors(NextResponse.json({ ok: true, id: existing.id, deduped: true }));
  }

  const item = await db.item.create({
    data: {
      userId,
      type: "article",
      status: "unread",
      url,
      title,
      excerpt: selection || null,
    },
    select: { id: true },
  });
  await indexItem(item.id, userId, title, selection || "");
  revalidatePath("/library");

  return cors(NextResponse.json({ ok: true, id: item.id }));
}
