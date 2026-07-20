# Save to LinkStash — browser extension

One-click saving of the current page (or a link) into your local LinkStash
library. It talks to the LinkStash desktop app running on your machine — no
account, no cloud.

## Install (unpacked)

The extension isn't in the Chrome/Firefox stores. Load it directly:

**Chrome / Edge**
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` folder.

**Firefox** (121+)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `extension/manifest.json`.
   (Temporary add-ons are removed when Firefox restarts.)

## Use

- Click the **Save to LinkStash** toolbar button to save the current page.
- Right-click a page, link, or selection → **Save … to LinkStash**.
- A ✓ badge and a notification confirm the save; saved pages appear in your
  library as unread, and the full article is fetched the first time you open it.

## How it finds the app

The desktop app listens on one of a fixed set of loopback ports (41797–41804).
The extension probes them for LinkStash's `/api/ping` and posts to `/api/ingest`
on the one that answers. The app must be **running** for saving to work.

Only extension requests are accepted by `/api/ingest` — ordinary web pages are
rejected, so no site can inject items into your library.
