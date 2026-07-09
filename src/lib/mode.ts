// LinkStash runs in one of two modes, selected by the LINKSTASH_MODE env var:
//
//   "server" (default) — the multi-user web app: real accounts, login required.
//   "local"            — the desktop app: no login. A single built-in local
//                        user owns everything, and sessions are implicit.
//
// The desktop (Tauri) build launches the Next server with LINKSTASH_MODE=local.

export const APP_MODE: "local" | "server" =
  process.env.LINKSTASH_MODE === "local" ? "local" : "server";

export const IS_LOCAL = APP_MODE === "local";

// The identity used for the single local user in desktop mode.
export const LOCAL_USER_EMAIL = "local@linkstash.app";
export const LOCAL_USER_NAME = "My Library";
