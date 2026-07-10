# 📚 LinkStash

**Your personal knowledge library.** Save articles, research papers (PDF), and
books (EPUB) in one place. Read them distraction-free, highlight passages, take
notes, organize with tags and collections, and search across everything you've
ever read.

A **local-first desktop app** (Windows/macOS/Linux via Tauri) — no login, fully
offline, your data in a folder you control. Open source.

> Built as a modern, own-your-data alternative to read-later apps — extended for
> research and book reading. A multi-user web build shares the same codebase.

---

## ⬇️ Download

Grab the latest installer from the
[**Releases**](https://github.com/AvishkaWeebadde/link-stash/releases) page
(Windows `.exe`). Installers are built automatically by CI on every tagged
release. Prefer to build it yourself? See [Desktop app](#️-desktop-app-tauri).

---

## ✨ Features

- **Save anything** — organized by what it *is*, not its file format:
  - 🌐 **Articles** — paste a URL; LinkStash fetches the page and extracts a
    clean, ad-free reading copy (powered by Mozilla Readability, the engine
    behind Firefox Reader View).
  - 📄 **Papers** & 📖 **Books** — import PDFs or EPUBs and choose how to file
    them. In-app reader with page/location tracking and resume-where-you-left-off.
  - 📝 **Notes** — jot standalone notes that live alongside your sources.
- **Read beautifully** — a calm, paper-like reader with light/dark themes, a
  serif reading typeface, and text/page **zoom** (with pan on zoomed PDFs).
- **Annotate, two ways** — highlight passages (text or drag-a-box on any PDF,
  even scanned), attach notes, and jot whole-item notes. Everything lives in one
  **Annotations panel**: click a highlight to jump to it in the document, or
  click a highlight in the document to focus its note.
- **Read aloud** 🔊 — text-to-speech for a selection, the current page/section,
  or the whole item, using the OS voices (no keys, offline).
- **Look up** 🔍 — select text for a dictionary definition + a Wikipedia summary
  (both keyless), or search the web.
- **OCR for scanned PDFs** 🔤 — recognize text on image-only PDFs so they become
  searchable, read-aloud-able, **and selectable** — runs offline.
- **Bookmarks** — save a spot (page / EPUB location) with an optional note and
  jump back.
- **Organize** — tag items, group them into collections, mark
  unread / reading / archived, and star favorites.
- **Search everything** — full-text search across titles and content (including
  OCR'd text), powered by SQLite FTS5 with relevance ranking.
- **Local-first desktop app** — no login, fully offline; your data lives in a
  folder you control. A multi-user web build shares the same codebase.

## 🛠️ Tech stack

| Layer            | Choice                                             |
| ---------------- | -------------------------------------------------- |
| Framework        | [Next.js 16](https://nextjs.org) (App Router) + React 19 |
| Language         | TypeScript                                         |
| Styling          | Tailwind CSS v4                                    |
| Database / ORM   | SQLite + [Prisma](https://www.prisma.io) (Postgres-ready) |
| Search           | SQLite FTS5 full-text index                        |
| Auth             | Custom sessions — `jose` (JWT) + `bcrypt`, no vendor lock-in |
| Article extract  | `@mozilla/readability` + `jsdom` + `DOMPurify`     |
| PDF / EPUB       | `pdfjs-dist` / `epub.js`                           |
| OCR              | `tesseract.js` (offline, bundled English model)    |
| Read aloud       | Web Speech API (`speechSynthesis`)                 |
| Desktop shell    | [Tauri 2](https://tauri.app) (Rust) + Node sidecar |

Everything runs locally with no third-party services required.

## 🚀 Getting started

**Prerequisites:** Node.js 20.19+ (or 22.13+) and npm.

```bash
# 1. Install dependencies (also generates the Prisma client + copies the PDF worker)
npm install

# 2. Create your environment file
cp .env.example .env
#    then set SESSION_SECRET — generate one with:
#    openssl rand -base64 32

# 3. Set up the database
npm run db:migrate

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>, create an account, and start stashing.

## 🖥️ Desktop app (Tauri)

LinkStash ships as a native desktop app — **no login, fully offline, your data
in a local folder**. It bundles the Next.js backend as a Node sidecar that the
app launches on `127.0.0.1`, with a native window (Tauri + the OS WebView).

**Prerequisites (Windows):** Rust (`rustup`, MSVC toolchain) and the Visual
Studio C++ Build Tools. Run `npx tauri info` to check.

```bash
# Develop the desktop app (hot-reloads the Next.js frontend, no login)
npm run tauri:dev

# Build a standalone installer (NSIS .exe on Windows)
npm run tauri:build
# → src-tauri/target/release/bundle/nsis/LinkStash_<version>_x64-setup.exe
```

The installed app stores everything in the OS app-data folder
(`%APPDATA%\app.linkstash.desktop` on Windows): a SQLite database seeded from a
migrated template on first launch, plus your uploaded PDFs/EPUBs. A crash log
for the backend is written there as `server.log`.

`npm run tauri:build` runs `scripts/build-desktop.mjs`, which produces the
Next.js standalone server, copies `.next/static` + `public`, bundles the Node
runtime, and generates the template database — all into `src-tauri/resources/`.

## 🐳 Running the web version with Docker

> The desktop app above is the primary way to use LinkStash. The multi-user web
> server below is optional and shares the same codebase (`LINKSTASH_MODE`).


```bash
# Provide a session secret (or put it in a .env file next to the compose file)
export SESSION_SECRET="$(openssl rand -base64 32)"

docker compose up --build
```

The SQLite database and uploaded files are stored in named volumes, so your
library survives container restarts and rebuilds.

## 📂 Project structure

```
src/
├── app/
│   ├── (auth)/            # login & signup (public)
│   ├── (app)/             # authenticated app: library + reader
│   │   ├── library/       # the grid, with filters & search
│   │   └── read/[id]/     # the reader (article / note / PDF / EPUB)
│   ├── files/[id]/        # owner-scoped file serving for uploads
│   └── actions/           # Server Actions (auth, items, highlights, …)
├── components/            # UI (reader, sidebar, dialogs, …)
├── lib/                   # db, session, DAL, extraction, search, storage
└── generated/prisma/      # generated Prisma client (gitignored)
prisma/
└── schema.prisma          # data model
```

## 🔐 How it works (a quick tour)

- **Auth** uses stateless, signed JWT sessions stored in an httpOnly cookie.
  A small **Data Access Layer** (`src/lib/dal.ts`) verifies the session and is
  called close to every data read/write — including inside every Server Action.
- **Saving an article** fetches the page server-side, runs Readability to pull
  out the main content, sanitizes the HTML with DOMPurify, resolves relative
  image URLs, and stores a clean copy plus plain text for search.
- **Search** maintains a SQLite FTS5 virtual table alongside your items and
  ranks results by relevance with highlighted snippets.
- **Highlights** on articles are anchored by character offsets into the
  content; on EPUBs they use EPUB CFI ranges via epub.js annotations.

## 🗺️ Roadmap

Shipped:

- [x] Read aloud (selection / page / whole item)
- [x] Look up & explore (dictionary + Wikipedia + web search)
- [x] Highlights + notes, unified with two-way jump-to navigation
- [x] Bookmarks
- [x] PDF area highlighting + text selection
- [x] OCR for scanned PDFs (offline) — searchable, read-aloud-able, selectable
- [x] Text/page zoom with pan
- [x] Published-installer release pipeline (tag → GitHub Release)

Next:

- [ ] **Code-signed installers** + Windows SmartScreen-clean install
- [ ] **macOS & Linux** release builds
- [ ] **Auto-update**
- [ ] Higher-accuracy OCR option; OCR quality/polish
- [ ] Import (Pocket, browser bookmarks, OPML) and export
- [ ] Browser extension for one-click saving
- [ ] Optional AI (auto-tag, summaries, "ask your library") — opt-in, BYO-key

Toward **v1.0**: code-signing + cross-platform builds + a polish pass.

## 🤝 Contributing

Issues and pull requests are welcome. This is an early open-source project —
if you find it useful, a star helps others discover it.

## 📄 License

[MIT](./LICENSE) — do what you like, no warranty.
