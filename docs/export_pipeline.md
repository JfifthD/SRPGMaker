# Export Pipeline

> How to build and package a SRPGMaker game project for each target platform.
> Updated: 2026-02-26

---

## Overview

Exporting a game produces a **standalone product** — no editor, no engine source exposed.
The export target determines the packaging format.

```
SRPGMaker (dev tool)
        │ GAME_ID=<id> vite build --mode game
        ▼
dist/                   ← Self-contained web build
├── index.html
├── assets/             ← Game assets (sprites, audio)
└── *.js                ← Engine (minified) + game data (bundled)
```

---

## Web Export

```bash
GAME_ID=chronicle-of-shadows npx vite build --mode game
```

Output: `dist/` directory

- Engine JS is minified + bundled (source not readable)
- Game data JSON is bundled into JS chunks
- Assets copied to `dist/assets/`
- Result: deployable on any static file server (Netlify, GitHub Pages, S3, etc.)

**Optional**: Encrypt game data JSON with a symmetric key embedded in the engine build.
Practical deterrent — not a cryptographic guarantee for web targets.

---

## iOS / Android (Capacitor)

Wraps the web build in a native shell.

```bash
# 1. Build web first
GAME_ID=chronicle-of-shadows npx vite build --mode game

# 2. Sync to Capacitor
npx cap copy ios    # or: npx cap copy android

# 3. Build native
npx cap build ios   # opens Xcode
npx cap build android
```

Requirements:
- iOS: Xcode + Apple Developer account
- Android: Android Studio + JDK

Game data is embedded in the native app bundle (`.ipa` / `.apk`).
More extraction-resistant than pure web.

---

## Desktop — Mac / Windows

### Tauri (preferred — ~5 MB Rust-based shell)

```bash
GAME_ID=chronicle-of-shadows npx tauri build
```

Output: `src-tauri/target/release/bundle/`
- macOS: `.dmg` / `.app`
- Windows: `.msi` / `.exe`

### Electron (alternative — larger binary)

```bash
GAME_ID=chronicle-of-shadows npx electron-builder
```

---

## Console (Future — Layered Approach)

Console targets require platform SDKs (Nintendo, Sony, etc.) and NDAs.

Planned approach:
1. WebView-based runtime on console dev kits → same web build runs inside console WebView
2. Platform-specific input mapping layer (controller → `InputHandler` events)
3. Platform SDK integration for storefront, saves, achievements

Status: Documented here; implement when console SDK access is available.

---

## Build Mode Reference

| Command | Output | Includes Editor? |
|---|---|---|
| `npm run dev` | Dev server (localhost:3000) | Yes (full SRPGMaker tool) |
| `vite build --mode game` | `dist/` — standalone game | No |
| `vite build --mode editor` | `dist/` — full SRPGMaker tool | Yes |

`GAME_ID` env var selects which game project to bundle (default: `chronicle-of-shadows`).

---

## Multiplayer Note

SRPGMaker does **not** provide a built-in backend.
Users who need multiplayer must self-host:

1. Export web build as usual
2. Deploy to a server (VPS, cloud provider, etc.)
3. Implement multiplayer networking layer with their own infrastructure

SRPGMaker provides engine APIs that emit/receive game state events — the transport layer
is left to the user.
