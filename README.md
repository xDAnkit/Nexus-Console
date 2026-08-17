# Nexus Console

Your Mac's local dev setup, in one window.

![Free](https://img.shields.io/badge/100%25-Free-brightgreen?style=for-the-badge)
![No ads](https://img.shields.io/badge/Ads-None-blue?style=for-the-badge)
![No tracking](https://img.shields.io/badge/Tracking-None-blueviolet?style=for-the-badge)
![Offline](https://img.shields.io/badge/Your%20data-Stays%20on%20your%20Mac-orange?style=for-the-badge)
![MIT license](https://img.shields.io/badge/License-MIT-lightgrey?style=for-the-badge)

|                                                                 |                                                                                                                 |
| :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| ✅&nbsp;&nbsp;**Free&nbsp;to&nbsp;use**&nbsp;&nbsp;&nbsp;&nbsp; | Every feature. No paid tier, no trial, no locked buttons.                                                       |
| ✅&nbsp;&nbsp;**No&nbsp;ads**&nbsp;&nbsp;&nbsp;&nbsp;           | Nothing is sold to you inside the app. Ever.                                                                    |
| ✅&nbsp;&nbsp;**No&nbsp;tracking**&nbsp;&nbsp;&nbsp;&nbsp;      | No analytics, no telemetry, no account, no server. Your data is never shared, because it never leaves your Mac. |

> The app has no network code of its own. It only talks to your own machine.

Nexus Console is a small macOS app that manages your [Homebrew](https://brew.sh) services and
packages, shows you which ports are busy, checks the health of your machine, and gives you a
terminal. No more remembering ten `brew` commands. Click a button instead.

Built with Tauri (Rust) + React. Runs on macOS 11 or newer.

## Why you'll like it

- **Free, ad-free, and private.** See above. That is the whole deal, no asterisk.
- **Light on resources.** Native Rust core, one small window, lives in the menu bar.
- **Pick what you need.** Turn modules on or off in Settings. The app hides what you don't use.

## What's inside

The app is split into modules. Each one is optional.

### Homebrew

- **Services** shows every Homebrew service with its real state, so a service that says "started"
  but is not actually healthy is marked as starting, not green. Start, stop and restart with one
  click. Install, uninstall, search for new formulae and switch versions.
- **Packages** lists everything you have installed and marks what is outdated. Upgrade one package
  or all of them, run `brew update`, read package info, and see what depends on a package before
  you remove it.
- **Sessions** keeps a simple history of what you ran and how long your services stayed up.

Runs a light check every few seconds so the menu bar count stays correct.

### Ports

See which process is listening on which port, and kill the stuck one by PID. Force kill and admin
escalation are there when a process will not go quietly. Nothing runs in the background.

### Doctor

Read-only health checks for your Mac. It looks at disk and system state, VSCode, browsers, Claude
Code and Ollama, then reports what is slow, what is eating storage, and what is just information.
Two rules it never breaks:

- Probes only read. They never start a daemon just to look at it.
- Every finding is honest about what it does. Cleaning disk space is labelled storage, not speed.

Fixes only happen when you press the button. There is also an optional daily VSCode cleanup that
runs while the app sits in the tray.

### Claude Chats

Browse your Claude Code chat history per project, and archive old chats so they stop piling up.
You choose how long to keep things. Archiving can run daily on its own if you want. This module
only appears if Claude Code is installed.

### Terminal

A real terminal built into the app, so you can drop to the shell without switching windows.

Plus: it sits in the menu bar, keeps your services running when you close the window, and sends
desktop notifications.

## Install and run

On a fresh Mac, three commands. The setup script checks for Xcode Command Line Tools, Homebrew,
Node 22.12 or newer, and Rust, then installs whatever is missing. It asks before each step.

```bash
git clone <this-repo> && cd NexusConsole
sh scripts/setup.sh     # add --yes to skip the prompts
npm start               # runs the app
```

### Using pnpm

pnpm works too, and it is faster. Install it first if you don't have it:

```bash
npm install -g pnpm     # or: corepack enable pnpm
```

Then:

```bash
pnpm install
pnpm start              # runs the app
pnpm release            # build the .app / .dmg
```

Pick one package manager and stick with it. Both `package-lock.json` and `pnpm-lock.yaml` are in
the repo, and switching back and forth just creates noise in your diffs. CI uses npm.

### Notes

- The first Rust build compiles every dependency and takes a few minutes. After that it is fast.
- `npm run dev` (or `pnpm dev`) starts Vite in the browser only. Most features will fail there
  because they need Rust. Use `npm start`.
- Skipping the setup script? You need **Xcode Command Line Tools**, **Homebrew**,
  **Node 22.12+**, and **Rust via [rustup](https://rustup.rs)**. Not `brew install rust`. Tauri
  needs rustup toolchains and the `rustfmt` and `clippy` parts the git hooks use. Then
  `npm install`.

## Everyday commands

```bash
npm start               # develop (Tauri + Vite)
npm run release         # production build
npm test                # vitest
npm run typecheck       # tsc --noEmit
npm run lint            # oxlint
npm run format          # prettier
cargo test   --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Git hooks (lefthook) run lint and format on commit, then typecheck, tests and clippy on push. CI
runs the same set.

## Privacy

Short version: the app has no network code for itself. It does not phone home.

- No accounts, no sign-in, no cloud.
- No analytics, no crash reporting, no usage stats.
- Your settings, sessions and archives are plain files on your own Mac.
- The only network access happens when Homebrew itself downloads a package you asked for.

## Troubleshooting

**Anything toolchain-related.** Run `npm run setup` again. It re-checks everything and fixes what
is missing. Open a **new terminal** afterwards so PATH changes apply.

**`cargo: command not found` when committing (especially from VSCode's Source Control).**
GUI git clients don't load your shell profile, so `~/.cargo/bin` isn't on their PATH.
[.lefthookrc](.lefthookrc) handles that, so make sure you have run `npm install`. In a terminal:
`source "$HOME/.cargo/env"`.

**Homebrew permission errors** (`Permission denied @ … /opt/homebrew`). Usually a Mac where brew
was installed by another user account:

```bash
sudo chown -R "$(whoami)" /opt/homebrew
```

**"Refusing to load formula … from untrusted tap".**
Homebrew 6 won't touch a third-party tap until you trust it. The app shows a **Trust tap** button
on that error. From a terminal it is `brew trust --tap <user/repo>`.

**App shows "Homebrew not detected".** It looks in `/opt/homebrew`, then `/usr/local`, then
`$HOMEBREW_PREFIX`. Install brew and relaunch. There is nothing to configure.

**"Nexus Console can't be opened" or "damaged" when opening a build on another Mac.**
The app is not signed with a paid Apple Developer certificate, so Gatekeeper quarantines a copied
build. Right-click the app, choose **Open**, then **Open** again. Or:

```bash
xattr -dr com.apple.quarantine "/Applications/Nexus Console.app"
```

Building on your own machine never hits this.

**Hook failure blocking an urgent commit.** `LEFTHOOK=0 git commit …` skips the hooks. CI still
runs the same checks, so it only delays the failure.

## License

[MIT](LICENSE). Use it, change it, ship it. Just keep the copyright notice.
