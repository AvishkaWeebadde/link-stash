import "server-only";
import { JSDOM } from "jsdom";

/**
 * Parsers that turn common "reading list" exports into a normalized list of
 * links we can import as article items. Everything is best-effort and lenient:
 * a malformed line is skipped, never fatal.
 */
export type ImportedLink = {
  url: string;
  title: string;
  tags: string[];
  author?: string;
  excerpt?: string;
};

export type ImportKind = "bookmarks" | "urls" | "bibtex";

const isHttp = (s: string) => /^https?:\/\//i.test(s);

/**
 * Netscape bookmark files (Chrome/Firefox/Edge/Safari "Export bookmarks") and
 * Pocket's HTML export are both just `<a href>` lists — Pocket adds a `tags`
 * attribute. Grab every http(s) link, its text as the title, and any tags.
 */
export function parseBookmarksHtml(html: string): ImportedLink[] {
  const { document } = new JSDOM(html).window;
  const out: ImportedLink[] = [];
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const url = a.getAttribute("href")?.trim() ?? "";
    if (!isHttp(url)) continue;
    const title = (a.textContent ?? "").trim() || url;
    const tags = (a.getAttribute("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    out.push({ url, title, tags });
  }
  return out;
}

/**
 * A plain list — one entry per line. Pull the first URL out of each line and
 * treat any leading text ("Title — https://…", "Title: https://…") as a title.
 */
export function parseUrlList(text: string): ImportedLink[] {
  const out: ImportedLink[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/https?:\/\/\S+/i);
    if (!m) continue;
    const url = m[0].replace(/[),.]+$/, ""); // trim trailing punctuation
    const lead = line.slice(0, m.index).replace(/[-–—:|]\s*$/, "").trim();
    out.push({ url, title: lead || url, tags: [] });
  }
  return out;
}

/** Strip BibTeX/LaTeX cruft ({}, escapes, collapsed whitespace). */
function clean(s: string): string {
  return s
    .replace(/[{}]/g, "")
    .replace(/\\[a-z]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Minimal BibTeX reader for Zotero/Mendeley exports. We only import entries we
 * can open — those with a `url` or a `doi` (turned into a doi.org link) — and
 * fold author/venue/year into the item's byline and excerpt.
 */
export function parseBibtex(text: string): ImportedLink[] {
  const out: ImportedLink[] = [];
  // Split on each "@type{" entry start.
  for (const chunk of text.split(/@(?=\w+\s*\{)/g)) {
    if (!/^\w+\s*\{/.test(chunk)) continue;
    const field = (name: string): string => {
      const m = chunk.match(
        new RegExp(`\\b${name}\\s*=\\s*(?:\\{([^{}]*)\\}|"([^"]*)"|([^,\\n]*))`, "i"),
      );
      return clean(m ? (m[1] ?? m[2] ?? m[3] ?? "") : "");
    };
    const doi = field("doi").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    const url = field("url") || (doi ? `https://doi.org/${doi}` : "");
    if (!isHttp(url)) continue;
    const title = field("title") || url;
    const author = field("author").replace(/\s+and\s+/gi, ", ");
    const venue = field("journal") || field("booktitle") || field("publisher");
    const excerpt = [venue, field("year")].filter(Boolean).join(", ");
    out.push({
      url,
      title,
      tags: [],
      author: author || undefined,
      excerpt: excerpt || undefined,
    });
  }
  return out;
}

/** Guess the format from the filename, falling back to content sniffing. */
export function detectKind(filename: string, content: string): ImportKind {
  const f = filename.toLowerCase();
  if (f.endsWith(".bib") || /^\s*@\w+\s*\{/.test(content)) return "bibtex";
  if (f.endsWith(".html") || f.endsWith(".htm") || /<a\s[^>]*href/i.test(content))
    return "bookmarks";
  return "urls";
}

export function parseImport(filename: string, content: string): ImportedLink[] {
  switch (detectKind(filename, content)) {
    case "bibtex":
      return parseBibtex(content);
    case "bookmarks":
      return parseBookmarksHtml(content);
    default:
      return parseUrlList(content);
  }
}
