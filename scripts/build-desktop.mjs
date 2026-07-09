// Assembles everything the desktop app's Node sidecar needs into
// src-tauri/resources/, then leaves the rest to `tauri build`.
//
//   resources/
//     server/               the Next.js standalone server (cwd for node)
//       server.js, .next/, node_modules/, public/, prisma engine, ...
//     node.exe              the Node runtime that runs server.js
//     linkstash-template.db a migrated, empty database copied to app-data
//                           on first launch
//
// Run automatically by `tauri build` (beforeBuildCommand), or manually.
import { cp, mkdir, rm, copyFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const R = (...p) => path.join(root, ...p);
const RES = R("src-tauri", "resources");
const SERVER = path.join(RES, "server");

function log(msg) {
  console.log(`[build-desktop] ${msg}`);
}

async function run() {
  // 0. Clean previous outputs BEFORE building. The staged resources and the
  //    old standalone bundle must not exist while Next traces the project, or
  //    they get recursively copied into the new bundle.
  log("Cleaning previous build output…");
  await rm(RES, { recursive: true, force: true });
  await rm(R(".next", "standalone"), { recursive: true, force: true });

  // 1. Build the Next.js app (produces .next/standalone and .next/static).
  log("Building Next.js (standalone)…");
  execSync("npx --no-install next build", { stdio: "inherit", cwd: root });

  const standalone = R(".next", "standalone");
  if (!existsSync(standalone)) {
    throw new Error(
      "Expected .next/standalone — is output:'standalone' set in next.config?",
    );
  }

  // 2. Create the staging directory.
  log("Staging server files…");
  await mkdir(SERVER, { recursive: true });

  // 3. Copy the standalone server, then the two directories Next does NOT
  //    include in standalone: .next/static and public/.
  // dereference: copy symlink *targets* as real files. Next's standalone
  // output symlinks deduped node_modules, and Windows blocks symlink
  // creation without elevation (EPERM).
  const cpOpts = { recursive: true, dereference: true };
  await cp(standalone, SERVER, cpOpts);
  await cp(R(".next", "static"), path.join(SERVER, ".next", "static"), cpOpts);
  if (existsSync(R("public"))) {
    await cp(R("public"), path.join(SERVER, "public"), cpOpts);
  }

  // 4. Make sure the Prisma query engine (.node) rode along in the trace.
  const engineDir = path.join(SERVER, "src", "generated", "prisma");
  let hasEngine = false;
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(engineDir);
    hasEngine = files.some((f) => f.endsWith(".node") || f.includes("query_engine"));
  } catch {
    /* dir missing */
  }
  if (!hasEngine) {
    log("Prisma engine not traced into standalone; copying it in…");
    await cp(R("src", "generated", "prisma"), engineDir, { recursive: true });
  }

  // 5. Bundle the Node runtime that will execute server.js.
  log(`Bundling Node runtime from ${process.execPath}`);
  await copyFile(process.execPath, path.join(RES, "node.exe"));

  // 6. Generate a migrated, empty template database.
  log("Generating template database…");
  const tmpDb = path.join(os.tmpdir(), `linkstash-template-${Date.now()}.db`);
  execSync("npx --no-install prisma migrate deploy", {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${tmpDb}` },
  });
  await access(tmpDb); // throws if migrate didn't create it where expected
  await copyFile(tmpDb, path.join(RES, "linkstash-template.db"));
  await rm(tmpDb, { force: true });

  log("Done. Resources ready in src-tauri/resources/");
}

run().catch((err) => {
  console.error("[build-desktop] FAILED:", err.message);
  process.exit(1);
});
