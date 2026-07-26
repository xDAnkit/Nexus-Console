# Nexus Console

A lightweight macOS desktop app for managing your local [Homebrew](https://brew.sh) setup — services, packages, ports, and a built-in terminal, all in one window instead of the command line.

Built with Tauri (Rust) + React.

## What it can do

- **Services** — see all your Homebrew services, and start / stop / restart them with a click. Install or uninstall formulae, search for new ones, and check available versions.
- **Packages** — list everything you've installed, spot what's outdated, upgrade one package or all at once, and run `brew update`. View package info and what depends on it before you remove anything.
- **Ports** — see which processes are listening on which ports, and kill a stuck one by PID (with an optional force / sudo).
- **Terminal** — a real embedded terminal, so you can drop to the shell without leaving the app.
- Lives in the menu-bar tray and sends desktop notifications.

## Set up on a fresh Mac

Run the setup check first — it tells you exactly what's missing and how to fix it:

```bash
npm run setup        # or: sh scripts/setup.sh  (works before npm install too)
```

If you'd rather do it by hand, this is everything the check verifies, in order:

1. **Xcode Command Line Tools** (compilers for the Rust build):

   ```bash
   xcode-select --install
   ```

2. **Homebrew** (the app manages it, and it's the easiest way to get Node):

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

   On Apple Silicon the installer finishes with two "Next steps" commands that add brew to your PATH — **run them**, or `brew` won't be found in new terminals:

   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

3. **Node ≥ 22.12**:

   ```bash
   brew install node
   ```

4. **Rust via rustup** — ⚠️ not `brew install rust`; Tauri needs rustup-managed toolchains, and the default install includes the `rustfmt`/`clippy` components the git hooks use:

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

   Then open a **new terminal** (or `source "$HOME/.cargo/env"`) so `cargo` is on PATH.

5. **Project dependencies** (this also installs the git hooks via lefthook):

   ```bash
   npm install
   ```

Re-run `npm run setup` until everything is ✓, then:

```bash
npm run tauri dev     # develop
npm run tauri build   # build the .app / .dmg
```

The built app lands in `src-tauri/target/release/bundle/`. The very first Rust build compiles all dependencies and takes several minutes — later builds are fast.

## Troubleshooting

**"Nexus Console can't be opened" / "damaged" when opening the built app on another Mac.**
The app isn't signed with a paid Apple Developer certificate, so macOS Gatekeeper quarantines a copied/downloaded build. Either right-click the app → **Open** → **Open** (once is enough), or clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/Nexus Console.app"
```

Building from source on your own machine never hits this.

**`cargo: command not found` when committing (especially from VSCode's Source Control).**
The git hooks run `cargo fmt` / `clippy`. GUI git clients don't load your shell profile, so `~/.cargo/bin` isn't on their PATH — [.lefthookrc](.lefthookrc) fixes that (make sure you've pulled it and run `npm install`). In a terminal, `source "$HOME/.cargo/env"` or open a new one. If Rust genuinely isn't installed, see step 4 above.

**`brew: command not found` right after installing Homebrew.**
The PATH step was skipped — run the two `shellenv` lines from step 2, then open a new terminal.

**Homebrew permission errors** (`Permission denied @ ...` under `/opt/homebrew`).
Usually a machine where brew was installed by another user account:

```bash
sudo chown -R "$(whoami)" /opt/homebrew
```

**Vite fails to start / cryptic `npm run dev` errors.**
Check `node --version` — this project needs ≥ 22.12 (`brew upgrade node`).

**Hook failure blocking an urgent commit.**
Fix the toolchain properly with `npm run setup`, but in an emergency: `LEFTHOOK=0 git commit ...` skips hooks — CI still runs the same checks, so it only defers the failure.

**App shows "Homebrew not detected".**
The app probes `/opt/homebrew` and `/usr/local`, then the `HOMEBREW_PREFIX` env var. Install brew (step 2) and relaunch — no config needed.

## Requirements (summary)

- macOS 11 or newer
- [Homebrew](https://brew.sh)
- Node.js ≥ 22.12 + [Rust via rustup](https://rustup.rs) (for building from source)
