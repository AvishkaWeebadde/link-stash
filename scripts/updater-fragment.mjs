// Emit this platform's slice of the Tauri updater manifest.
//
// Run on each build runner AFTER `tauri build`. It finds the signed updater
// artifact (the one file with a matching `.sig`) under src-tauri/target, works
// out this OS/arch's updater platform key, and writes `fragment-<key>.json`
// containing { "<key>": { signature, url } }. The release job merges every
// fragment into a single latest.json.
//
// We glob for the `.sig` rather than assuming a filename, because the updater
// artifact differs per platform (Windows -setup.exe, macOS .app.tar.gz, Linux
// .AppImage) and we don't want to hard-code those names.
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const TAG = process.env.TAG; // e.g. v1.1.0
const REPO = process.env.REPO; // e.g. AvishkaWeebadde/link-stash
if (!TAG || !REPO) {
  throw new Error("TAG and REPO env vars are required");
}

const bundleRoot = path.join("src-tauri", "target", "release", "bundle");

async function findSigs(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findSigs(full)));
    else if (e.name.endsWith(".sig")) out.push(full);
  }
  return out;
}

function platformKey() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const os = { win32: "windows", darwin: "darwin", linux: "linux" }[process.platform];
  if (!os) throw new Error(`unsupported platform ${process.platform}`);
  return `${os}-${arch}`;
}

const sigs = await findSigs(bundleRoot);
if (sigs.length === 0) {
  throw new Error(`no updater signature (*.sig) found under ${bundleRoot} — is TAURI_SIGNING_PRIVATE_KEY set?`);
}
// CI runners are clean (one artifact), but if stale sigs from earlier builds
// linger, take the most recently written one.
const withTimes = await Promise.all(
  sigs.map(async (s) => ({ s, mtime: (await stat(s)).mtimeMs })),
);
withTimes.sort((a, b) => b.mtime - a.mtime);
const sigPath = withTimes[0].s;
const signedFile = sigPath.replace(/\.sig$/, "");
const signature = (await readFile(sigPath, "utf8")).trim();
const key = platformKey();
const url = `https://github.com/${REPO}/releases/download/${TAG}/${encodeURIComponent(
  path.basename(signedFile),
)}`;

const fragment = { [key]: { signature, url } };
const outName = `fragment-${key}.json`;
await writeFile(outName, JSON.stringify(fragment, null, 2));
console.log(`[updater-fragment] ${outName} → ${key}: ${path.basename(signedFile)}`);
