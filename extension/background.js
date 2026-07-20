// "Save to LinkStash" — sends the current page (or a link/selection) to the
// locally running LinkStash desktop app.
//
// The app serves on one of a fixed set of loopback ports (it can't advertise a
// random one to the extension), so we probe them for the /api/ping marker and
// POST to /api/ingest on whichever answers. Keep PORTS in sync with
// PREFERRED_PORTS in src-tauri/src/lib.rs.

const PORTS = [41797, 41798, 41799, 41800, 41801, 41802, 41803, 41804];

async function ping(port) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 700);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    return data && data.app === "linkstash";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function findBase() {
  for (const port of PORTS) {
    if (await ping(port)) return `http://127.0.0.1:${port}`;
  }
  return null;
}

function badge(text, color) {
  try {
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);
  } catch {
    /* action badge unavailable */
  }
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
    });
  } catch {
    /* notifications unavailable */
  }
}

async function save({ url, title, selection }) {
  if (!url || !/^https?:\/\//i.test(url)) {
    badge("!", "#b91c1c");
    notify("Can't save this", "Only http(s) pages can be saved.");
    return;
  }
  const base = await findBase();
  if (!base) {
    badge("!", "#b91c1c");
    notify("LinkStash isn't running", "Open the LinkStash app, then try again.");
    return;
  }
  try {
    const res = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, title: title || url, selection: selection || "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      badge("✓", "#15803d");
      notify(
        data.deduped ? "Already saved" : "Saved to LinkStash",
        title || url,
      );
    } else {
      badge("!", "#b91c1c");
      notify("Couldn't save", data.error || `Error ${res.status}`);
    }
  } catch (e) {
    badge("!", "#b91c1c");
    notify("Couldn't save", String(e && e.message ? e.message : e));
  }
}

// Toolbar button: save the active tab.
chrome.action.onClicked.addListener((tab) => {
  save({ url: tab.url, title: tab.title, selection: "" });
});

// Right-click menu.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "ls-page", title: "Save page to LinkStash", contexts: ["page"] });
  chrome.contextMenus.create({ id: "ls-link", title: "Save link to LinkStash", contexts: ["link"] });
  chrome.contextMenus.create({
    id: "ls-sel",
    title: "Save page (with selection) to LinkStash",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ls-link" && info.linkUrl) {
    save({ url: info.linkUrl, title: info.linkUrl, selection: "" });
  } else {
    save({ url: tab && tab.url, title: tab && tab.title, selection: info.selectionText || "" });
  }
});
