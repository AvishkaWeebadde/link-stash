import "server-only";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

export type ExtractedArticle = {
  title: string;
  author: string | null;
  siteName: string | null;
  excerpt: string | null;
  lang: string | null;
  contentHtml: string;
  textContent: string;
  wordCount: number;
  coverImage: string | null;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; LinkStash/1.0; +https://github.com/linkstash)";

/**
 * Fetch a URL and extract a clean, readable article from it using Mozilla's
 * Readability (the engine behind Firefox Reader View), then sanitize the HTML.
 */
export async function extractArticle(url: string): Promise<ExtractedArticle> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Could not fetch page (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new Error("That URL does not point to an HTML page.");
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Best-effort lead image + lang before Readability strips <head>.
  const ogImage =
    doc
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content")
      ?.trim() ?? null;
  const lang = doc.documentElement.getAttribute("lang");

  const reader = new Readability(doc);
  const parsed = reader.parse();

  if (!parsed || !parsed.content) {
    throw new Error(
      "Couldn't extract readable content from this page. Try saving it as a note instead.",
    );
  }

  const cleanHtml = sanitizeHtml(parsed.content, url);
  const textContent = (parsed.textContent ?? "").replace(/\s+/g, " ").trim();
  const wordCount = textContent ? textContent.split(/\s+/).length : 0;

  return {
    title: parsed.title?.trim() || new URL(url).hostname,
    author: parsed.byline?.trim() || null,
    siteName: parsed.siteName?.trim() || new URL(url).hostname,
    excerpt: parsed.excerpt?.trim() || null,
    lang: lang || parsed.lang || null,
    contentHtml: cleanHtml,
    textContent,
    wordCount,
    coverImage: resolveUrl(ogImage, url),
  };
}

/** Sanitize untrusted HTML, resolving relative asset URLs against the source. */
export function sanitizeHtml(dirty: string, baseUrl?: string): string {
  const window = new JSDOM("").window;
  const purify = createDOMPurify(
    window as unknown as Parameters<typeof createDOMPurify>[0],
  );

  const clean = purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "b", "strong", "i", "em", "u", "s", "mark", "small", "sub", "sup",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "img", "figure", "figcaption", "picture", "source",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div",
    ],
    ALLOWED_ATTR: [
      "href", "src", "srcset", "alt", "title", "width", "height",
      "colspan", "rowspan", "start", "type",
    ],
    ALLOW_DATA_ATTR: false,
  });

  if (!baseUrl) return clean;

  // Resolve relative <img>/<a> URLs so images load in the reader.
  const dom = new JSDOM(clean);
  const doc = dom.window.document;
  doc.querySelectorAll("img[src]").forEach((el) => {
    const abs = resolveUrl(el.getAttribute("src"), baseUrl);
    if (abs) el.setAttribute("src", abs);
    el.removeAttribute("srcset");
    el.setAttribute("loading", "lazy");
  });
  doc.querySelectorAll("a[href]").forEach((el) => {
    const abs = resolveUrl(el.getAttribute("href"), baseUrl);
    if (abs) el.setAttribute("href", abs);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });
  return doc.body.innerHTML;
}

function resolveUrl(maybe: string | null, base: string): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}
