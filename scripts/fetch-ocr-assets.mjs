// Assemble Tesseract OCR assets into public/tesseract so OCR runs offline:
// the worker + wasm core (from node_modules) and the English trained data
// (downloaded once). Best-effort — OCR degrades gracefully if unavailable.
import { cp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "public", "tesseract");
const LANG_URL = "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";

async function run() {
  await mkdir(OUT, { recursive: true });

  const worker = path.join(root, "node_modules/tesseract.js/dist/worker.min.js");
  const core = path.join(root, "node_modules/tesseract.js-core");
  if (existsSync(worker)) await copyFile(worker, path.join(OUT, "worker.min.js"));
  if (existsSync(core)) await cp(core, OUT, { recursive: true });

  const lang = path.join(OUT, "eng.traineddata.gz");
  if (!existsSync(lang)) {
    const res = await fetch(LANG_URL);
    if (!res.ok) throw new Error(`lang download HTTP ${res.status}`);
    await writeFile(lang, Buffer.from(await res.arrayBuffer()));
  }
  console.log("[ocr-assets] ready in public/tesseract");
}

run().catch((e) => {
  console.warn("[ocr-assets] skipped:", e.message);
});
