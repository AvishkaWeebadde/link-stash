import "server-only";
import { JSDOM } from "jsdom";

// Extract plain text from uploaded documents so they can be read aloud and
// full-text searched. Runs server-side at upload time (Node), where pdf.js /
// zip parsing are reliable. Output is capped to keep DB rows reasonable.

const MAX_CHARS = 2_000_000;

export type ExtractedText = { text: string; words: number };

function finalize(raw: string): ExtractedText {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  return { text, words: text ? text.split(/\s+/).length : 0 };
}

/** Extract text from a PDF using pdf.js's Node-friendly legacy build. */
export async function extractPdfText(data: Buffer): Promise<ExtractedText> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
    const doc = await loadingTask.promise;

    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out +=
        tc.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((it: any) => ("str" in it ? it.str : ""))
          .join(" ") + "\n";
      if (out.length > MAX_CHARS) break;
    }
    await loadingTask.destroy();
    return finalize(out);
  } catch {
    return { text: "", words: 0 };
  }
}

/** Extract text from an EPUB by reading its spine documents in order. */
export async function extractEpubText(data: Buffer): Promise<ExtractedText> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(data);

    // 1. container.xml points to the OPF package document.
    const containerXml = await zip.file("META-INF/container.xml")?.async("string");
    if (!containerXml) return { text: "", words: 0 };
    const container = new JSDOM(containerXml, { contentType: "text/xml" });
    const opfPath = container.window.document
      .querySelector("rootfile")
      ?.getAttribute("full-path");
    if (!opfPath) return { text: "", words: 0 };

    const opfDir = opfPath.includes("/")
      ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
      : "";

    // 2. Parse the OPF: manifest (id -> href) and spine (reading order).
    const opfXml = await zip.file(opfPath)?.async("string");
    if (!opfXml) return { text: "", words: 0 };
    const opf = new JSDOM(opfXml, { contentType: "text/xml" }).window.document;

    const hrefById = new Map<string, string>();
    opf.querySelectorAll("manifest > item").forEach((item) => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href) hrefById.set(id, href);
    });

    const spine = Array.from(opf.querySelectorAll("spine > itemref"))
      .map((ref) => ref.getAttribute("idref"))
      .filter((id): id is string => !!id);

    // 3. Read each spine document and pull its text.
    let out = "";
    for (const id of spine) {
      const href = hrefById.get(id);
      if (!href) continue;
      const path = opfDir + href.split("#")[0];
      const html = await zip.file(path)?.async("string");
      if (!html) continue;
      const body = new JSDOM(html).window.document.body;
      out += (body?.textContent ?? "") + "\n";
      if (out.length > MAX_CHARS) break;
    }
    return finalize(out);
  } catch {
    return { text: "", words: 0 };
  }
}
