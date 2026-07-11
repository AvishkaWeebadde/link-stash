// Merge every per-platform updater fragment into one latest.json.
//
// Run in the release job after downloading all build artifacts. It scans a
// directory tree for `fragment-*.json` files and combines their platform
// entries into a single manifest the app polls. Missing platforms (e.g. a
// build that failed during bring-up) are simply absent — the release still
// ships for the platforms that succeeded.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TAG = process.env.TAG;
if (!TAG) throw new Error("TAG env var is required");
const version = TAG.replace(/^v/, "");
const searchDir = process.argv[2] || ".";
const outPath = process.argv[3] || "latest.json";

async function findFragments(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findFragments(full)));
    else if (/^fragment-.*\.json$/.test(e.name)) out.push(full);
  }
  return out;
}

const fragments = await findFragments(searchDir);
if (fragments.length === 0) {
  throw new Error(`no fragment-*.json found under ${searchDir}`);
}

const platforms = {};
for (const f of fragments) {
  Object.assign(platforms, JSON.parse(await readFile(f, "utf8")));
}

const manifest = {
  version,
  notes: "See the release page for what's new.",
  pub_date: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  platforms,
};

await writeFile(outPath, JSON.stringify(manifest, null, 2));
console.log(`[merge-manifest] ${outPath} with platforms: ${Object.keys(platforms).join(", ")}`);
