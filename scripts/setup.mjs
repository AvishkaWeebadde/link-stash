// Runs on postinstall (and via `npm run setup`):
//   1. Copy the pdf.js worker into /public so the PDF reader can load it.
//   2. Generate the Prisma client.
// Both steps are best-effort and safe to re-run.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

async function copyPdfWorker() {
  const src = path.join(
    root,
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs",
  );
  if (!existsSync(src)) {
    console.warn("[setup] pdf.js worker not found; skipping copy.");
    return;
  }
  const destDir = path.join(root, "public");
  await mkdir(destDir, { recursive: true });
  await copyFile(src, path.join(destDir, "pdf.worker.min.mjs"));
  console.log("[setup] Copied pdf.js worker to public/.");
}

function generatePrisma() {
  try {
    execSync("npx --no-install prisma generate", { stdio: "inherit" });
  } catch {
    console.warn("[setup] `prisma generate` failed; run it manually if needed.");
  }
}

await copyPdfWorker();
generatePrisma();
