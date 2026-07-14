# Nexus Console

A lightweight macOS desktop app for managing your local [Homebrew](https://brew.sh) setup — services, packages, ports, and a built-in terminal, all in one window instead of the command line.

Built with Tauri (Rust) + React.

## What it can do

- **Services** — see all your Homebrew services, and start / stop / restart them with a click. Install or uninstall formulae, search for new ones, and check available versions.
- **Packages** — list everything you've installed, spot what's outdated, upgrade one package or all at once, and run `brew update`. View package info and what depends on it before you remove anything.
- **Ports** — see which processes are listening on which ports, and kill a stuck one by PID (with an optional force / sudo).
- **Terminal** — a real embedded terminal, so you can drop to the shell without leaving the app.
- Lives in the menu-bar tray and sends desktop notifications.

## Requirements

- macOS 11 or newer
- [Homebrew](https://brew.sh) installed
- Node.js + [Rust](https://rustup.rs) (for building from source)

## Run it

```bash
npm install
npm run tauri dev     # develop
npm run tauri build   # build the .app / .dmg
```

The built app lands in `src-tauri/target/release/bundle/`.
