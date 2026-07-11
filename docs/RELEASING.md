# Releasing LinkStash

Releases are built and published by GitHub Actions ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) when you push a version tag.

## One-time setup: updater signing secrets

LinkStash desktop updates itself. Each release ships a signed installer plus a
`latest.json` manifest; installed apps poll the latest release and self-update.
Signing needs a private key, kept as a repo secret.

The keypair already exists (public key is committed in
`src-tauri/tauri.conf.json` under `plugins.updater.pubkey`). Add the **private
key** as a secret so CI can sign releases:

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add just one secret:
   - `TAURI_SIGNING_PRIVATE_KEY` — the full contents of the private key file.

> The key has **no password**, so the workflow passes an empty
> `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` literal. Do **not** create a password
> secret — GitHub secrets can't be empty, and any non-empty value makes signing
> fail with "wrong password for that key".

> Keep the private key safe and out of git. If it is lost, existing installs
> can no longer verify updates and users must reinstall manually. To rotate it,
> generate a new keypair (`npx @tauri-apps/cli signer generate`), update the
> `pubkey` in `tauri.conf.json`, and replace the secret.

## Cutting a release

```bash
# 1. Bump the version in all four places (keep them in sync):
#    package.json, src-tauri/tauri.conf.json,
#    src-tauri/Cargo.toml, src-tauri/Cargo.lock (the [[package]] name = "linkstash" entry)
# 2. Commit, then tag and push:
git tag v1.0.0
git push origin main --tags
```

The workflow builds installers on Windows, macOS, and Linux in parallel, signs
each, generates a per-platform manifest fragment, merges them into one
`latest.json`, and publishes a GitHub Release with every installer, its `.sig`,
and the manifest.

## Platforms

| OS | Bundles | Status |
|----|---------|--------|
| Windows | NSIS `-setup.exe` | Verified. Unsigned installer → SmartScreen "More info → Run anyway". |
| macOS | `.dmg` + `.app.tar.gz` (updater) | Built by CI, **not yet verified on hardware**. Unsigned → Gatekeeper: right-click → Open (no paid Apple cert). |
| Linux | `.AppImage` + `.deb` | Built by CI, **not yet verified on hardware**. AppImage needs `libwebkit2gtk-4.1` installed at runtime. |

The **release job runs even if a platform build fails**, so a broken macOS or
Linux job never blocks the Windows release — the failed platform is simply
absent from that release's `latest.json`. Each platform's updater key is:
`windows-x86_64`, `darwin-aarch64`, `linux-x86_64`.

## How auto-update works at runtime

- The app checks `releases/latest/download/latest.json` ~5s after launch
  (desktop, release builds only).
- If a newer version is listed, it downloads and installs the signed installer
  silently, then relaunches into the new version.
- Any failure (offline, no manifest, bad signature) is ignored — it never
  blocks normal use.
