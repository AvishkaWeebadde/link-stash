// Assemble Tesseract OCR assets into public/tesseract so OCR runs offline:
// the worker + wasm core (from node_modules) and the English trained data
// (downloaded once). Best-effort — OCR degrades gracefully if unavailable.
import { cp, mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "public", "tesseract");

// Trained-data variant. "best" is the highest-accuracy LSTM model (~15MB, used
// with OEM 1 / LSTM-only in the reader); "fast" (~2MB) trades accuracy for
// speed. We ship "best" — OCR runs in the background, so accuracy wins.
const LANG_VARIANT = "4.0.0_best";
const LANG_URL = `https://tessdata.projectnaptha.com/${LANG_VARIANT}/eng.traineddata.gz`;

async function run() {
  await mkdir(OUT, { recursive: true });

  const worker = path.join(root, "node_modules/tesseract.js/dist/worker.min.js");
  const core = path.join(root, "node_modules/tesseract.js-core");
  if (existsSync(worker)) await copyFile(worker, path.join(OUT, "worker.min.js"));
  if (existsSync(core)) await cp(core, OUT, { recursive: true });

  // Re-download when the variant changes (a stale fast model would otherwise
  // stick around because the filename is the same).
  const lang = path.join(OUT, "eng.traineddata.gz");
  const marker = path.join(OUT, ".lang-variant");
  const have = existsSync(marker) ? (await readFile(marker, "utf8")).trim() : "";
  if (!existsSync(lang) || have !== LANG_VARIANT) {
    const res = await fetch(LANG_URL);
    if (!res.ok) throw new Error(`lang download HTTP ${res.status}`);
    await writeFile(lang, Buffer.from(await res.arrayBuffer()));
    await writeFile(marker, LANG_VARIANT);
  }
  console.log(`[ocr-assets] ready in public/tesseract (${LANG_VARIANT})`);
}

run().catch((e) => {
  console.warn("[ocr-assets] skipped:", e.message);
});
