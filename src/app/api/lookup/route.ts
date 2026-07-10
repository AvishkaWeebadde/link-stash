import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";

// Look up a selected word/phrase: a dictionary definition + a Wikipedia
// summary. Both are free and keyless; we proxy them server-side to avoid CORS
// and keep the client simple. Never throws — missing pieces come back null.

const UA = "LinkStash/1.0 (https://github.com/AvishkaWeebadde/link-stash)";

async function getJson(url: string, timeoutMs = 6000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Definition = { partOfSpeech: string; meanings: string[] };

async function fetchDefinition(
  word: string,
): Promise<{ phonetic: string | null; entries: Definition[] } | null> {
  const data = await getJson(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0] as {
    phonetic?: string;
    phonetics?: { text?: string }[];
    meanings?: {
      partOfSpeech?: string;
      definitions?: { definition?: string }[];
    }[];
  };
  const phonetic =
    first.phonetic || first.phonetics?.find((p) => p.text)?.text || null;
  const entries: Definition[] =
    first.meanings?.map((m) => ({
      partOfSpeech: m.partOfSpeech ?? "",
      meanings: (m.definitions ?? [])
        .map((d) => d.definition ?? "")
        .filter(Boolean)
        .slice(0, 3),
    })) ?? [];
  return { phonetic, entries };
}

async function fetchWiki(
  term: string,
): Promise<{ title: string; extract: string; url: string } | null> {
  // Resolve the best-matching title, then fetch its summary.
  const search = (await getJson(
    `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(
      term,
    )}&limit=1`,
  )) as { pages?: { title?: string; key?: string }[] } | null;

  const title = search?.pages?.[0]?.key ?? search?.pages?.[0]?.title ?? term;
  const summary = (await getJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title,
    )}`,
  )) as {
    title?: string;
    extract?: string;
    type?: string;
    content_urls?: { desktop?: { page?: string } };
  } | null;

  if (!summary?.extract || summary.type === "disambiguation") return null;
  return {
    title: summary.title ?? title,
    extract: summary.extract,
    url:
      summary.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) return new Response(null, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ error: "Nothing to look up." }, { status: 400 });

  const term = q.slice(0, 200);
  const firstWord = term.split(/\s+/)[0].replace(/[^\p{L}\p{N}'-]/gu, "");

  const [dict, wiki] = await Promise.all([
    firstWord ? fetchDefinition(firstWord) : Promise.resolve(null),
    fetchWiki(term),
  ]);

  return Response.json({ term, word: firstWord, dict, wiki });
}
