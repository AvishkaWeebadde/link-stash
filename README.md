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
- **Read beautifully** — a calm, paper-like reader with light/dark themes and a
  serif reading typeface.
- **Highlight & annotate** — select text to highlight (five colors), attach
  notes, and review all highlights per item.
- **Organize** — tag items, group them into collections, and mark
  unread / reading / archived. Star your favorites.
- **Search everything** — full-text search across titles, content, and more,
  powered by SQLite FTS5 with relevance ranking.
- **Multi-user** — real accounts with secure sessions; each person's library is
  private to them.
- **Self-hostable** — SQLite by default (zero setup), a Docker image for
  one-command deployment, and a clean path to Postgres for scale.

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

Planned next:

- [ ] **Bookmarks** — save a spot in a document to jump back to.
- [ ] **Section notes** — attach a note to a selected passage (beyond highlights).
- [ ] **Read aloud** — a voice assistant that reads the selection or whole item
      (text-to-speech), with play/pause and follow-along.
- [ ] **Look up & explore** — select text to get a definition and related results
      from the web.
- [ ] Inline text-layer highlighting for PDFs (currently: reading + progress).

Later:

- [ ] Import/export (OPML, Pocket, browser bookmarks).
- [ ] Browser extension for one-click saving.
- [ ] Auto-update + code-signed installers; macOS/Linux release builds.
- [ ] Optional AI features (auto-tagging, summaries, "ask your library") —
      opt-in, bring-your-own-key.

## 🤝 Contributing

Issues and pull requests are welcome. This is an early open-source project —
if you find it useful, a star helps others discover it.

## 📄 License

[MIT](./LICENSE) — do what you like, no warranty.
