# Developing LinkStash (solo handbook)

Everything you need to build, run, and ship LinkStash by yourself. For the
release/CI flow see [`RELEASING.md`](./RELEASING.md); for the user-facing intro
see the [README](../README.md). This doc is the day-to-day operator's guide.

---

## 0. One-time machine setup

You need these installed once:

| Tool | Why | Notes |
|------|-----|-------|
| **Node.js** (LTS) | Next.js build + runtime | `npm install` also runs `postinstall` → `scripts/setup.mjs` (generates Prisma client, copies the PDF worker) |
| **Rust** (stable) + **MSVC build tools** | Tauri desktop compile | `cargo` must be on PATH — it lives at `~/.cargo/bin` |
| **The updater signing key** | Every `tauri build` requires it | Private key at `C:\Users\Avishka\.linkstash-keys\linkstash.key` (no password). **Back it up** — losing it breaks auto-update for all installs. |

First-time repo setup:

```bash
npm install                 # deps + Prisma client + PDF worker
cp .env.example .env         # then set SESSION_SECRET (see below)
npm run setup                # runs scripts/setup.mjs + prisma migrate deploy
```

**`.env`** (see `.env.example`):

```bash
DATABASE_URL="file:./dev.db"          # SQLite path is relative to prisma/
SESSION_SECRET="<long random string>" # generate: openssl rand -base64 32
```

`SESSION_SECRET` only matters for the multi-user **web** mode (JWT sessions).
The desktop app runs in `local` mode with no login, but keep a value set so the
web build doesn't error.

---

## 1. Two ways to run it

LinkStash is one Next.js app that runs in two modes, plus a Tauri shell:

- **Web mode** — multi-user, auth (JWT + bcrypt). `LINKSTASH_MODE` unset.
- **Local mode** — single user, no login, local-first. `LINKSTASH_MODE=local`.
- **Desktop** — Tauri wraps the *local-mode* app in a native window.

### Everyday development

```bash
npm run dev:local     # local mode (no login) in the browser — fastest loop
npm run dev           # web/multi-user mode in the browser
npm run tauri:dev     # native desktop window against the dev server (hot reload)
```

Use `tauri:dev` when you're working on desktop-specific behavior (window,
updater, file paths). Use `dev:local` for pure UI/feature work — it's faster.

### Database work

```bash
npm run db:migrate    # create + apply a new migration (prisma migrate dev)
npm run db:deploy     # apply existing migrations (prisma migrate deploy)
npm run db:studio     # visual DB browser
```

---

## 2. Building + installing the desktop app locally

This is the full "test it as a real installed app" cycle. Do this **once per
committed milestone**, not after every edit (that's what `tauri:dev` is for).

Run from the repo root (`f:/New folder/linkstash`), Git Bash:

```bash
# 1. Environment: cargo on PATH + signing key (build FAILS unsigned)
export PATH="$HOME/.cargo/bin:$PATH"
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.linkstash-keys/linkstash.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""     # empty on purpose — key has no password

# 2. Build → produces the NSIS installer + its .sig
npm run tauri:build
#   → src-tauri/target/release/bundle/nsis/LinkStash_<version>_x64-setup.exe
#   → ...LinkStash_<version>_x64-setup.exe.sig   (updater signature)

# 3. Stop any running instance so files aren't locked, then silent-install
taskkill //IM linkstash.exe //F 2>/dev/null
./src-tauri/target/release/bundle/nsis/LinkStash_<version>_x64-setup.exe //S

# 4. Launch the installed build
"C:/Users/Avishka/AppData/Local/LinkStash/linkstash.exe"
```

> **Git Bash slash escaping:** `//IM`, `//F`, `//S` are the doubled form of the
> real `/IM`, `/F`, `/S` flags. MSYS/Git-Bash rewrites a single leading `/` into
> a Windows path, so you double it. In cmd/PowerShell use single slashes.

Verify what actually got installed:

```bash
# read the installed exe's version
powershell.exe -NoProfile -Command \
  "(Get-Item 'C:/Users/Avishka/AppData/Local/LinkStash/linkstash.exe').VersionInfo.ProductVersion"
```

**Install location:** `C:\Users\Avishka\AppData\Local\LinkStash\`
**App data / DB:** `%APPDATA%\app.linkstash.desktop\` (DB seeded from a template
on first run).

---

## 3. Cutting a release (short version)

Full details in [`RELEASING.md`](./RELEASING.md). The short loop:

```bash
# Bump the version in ALL FOUR places, kept in sync:
#   package.json
#   src-tauri/tauri.conf.json
#   src-tauri/Cargo.toml
#   src-tauri/Cargo.lock   (the [[package]] name = "linkstash" entry)

git commit -am "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds Windows
+ macOS + Linux installers, signs each, merges a `latest.json` updater manifest,
and publishes a GitHub Release. **CI needs the repo secret
`TAURI_SIGNING_PRIVATE_KEY`** set (no password secret) or the release fails.

After releasing, installed apps self-update: ~5s after launch they poll the
latest release's `latest.json`, and silently download + install + relaunch if a
newer signed version exists.

---

## 4. Gotchas (hard-won — don't re-learn these)

**Build / packaging**
- `bundle.createUpdaterArtifacts: true` means **every** `tauri build` requires
  the signing env vars from step 1. No key → build errors out.
- Next standalone traces the whole project. `src-tauri/`, `uploads/`, and
  `.next/standalone` are excluded in `outputFileTracingExcludes`, and the build
  cleans first — otherwise it recursively copies prior bundles and dies on path
  length.
- Keep the version in sync across all four files (see §3) or the installer,
  Cargo build, and updater manifest disagree.

**Runtime (desktop, Windows)**
- The Rust shell (`src-tauri/src/lib.rs`) spawns the bundled Next standalone
  server via a bundled `node.exe` on a **random loopback port**, then points the
  webview at it.
- Strip the `\\?\` verbatim prefix from paths before handing them to node.
- Spawn the child with `CREATE_NO_WINDOW` (no console popup) and redirect its
  stdio to a log file — GUI apps have no valid stdio, so node crashes otherwise.
- The nav handler opens external links in the OS browser, but must treat
  `localhost` / `127.0.0.1` / `tauri.localhost` as **internal**.

**Data model**
- SQLite `file:` URLs resolve relative to the schema dir (Prisma CLI) vs CWD
  (runtime) — normalized in `src/lib/db.ts` + `prisma.config.ts`.
- Item `type` is the user-facing *kind* (article/paper/book/note), decoupled
  from file *format*; the reader picks the pdf/epub/html renderer from the file
  extension via `itemFormat`.

**UI**
- Use the in-app modal (`src/components/confirm-button.tsx`), never the browser
  `confirm()`.

---

## 5. Quick reference — every command

```bash
# --- dev ---
npm run dev:local        # local mode in browser (no login)  ← main dev loop
npm run dev              # web/multi-user mode in browser
npm run tauri:dev        # native desktop window, hot reload

# --- db ---
npm run db:migrate       # new migration
npm run db:deploy        # apply migrations
npm run db:studio        # DB browser

# --- quality ---
npm run lint

# --- desktop build + install (per committed milestone) ---
export PATH="$HOME/.cargo/bin:$PATH"
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.linkstash-keys/linkstash.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
taskkill //IM linkstash.exe //F 2>/dev/null
./src-tauri/target/release/bundle/nsis/LinkStash_<version>_x64-setup.exe //S
"C:/Users/Avishka/AppData/Local/LinkStash/linkstash.exe"

# --- release ---
git tag vX.Y.Z && git push origin main --tags
```
