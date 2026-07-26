# Nexus Doctor — Session Context (2026-07-17)

> This document is the complete, structured capture of the debugging/optimization session
> (Claude Code, project `AvinyX/9-June`) that produced the Nexus Doctor product idea.
> It exists so the full context lives **in this repo** — you can close that chat window
> and build everything from here. The raw transcript remains available in
> `~/.claude/projects/-Users-ankitjain-Documents-AvinyX-9-June/58bf46d3-*.jsonl`
> (and this chat stays visible in the VSCode Claude panel while it is < archive cutoff).

---

## 1. The story in one paragraph

The complaint was "VSCode hangs and lags on this project, works fine on others; also the
Mac feels slow and battery drains fast." Over one session we measured (not guessed) our way
to the real causes: **Low Power Mode was throttling the CPU**, **Chrome extensions cost
1.38 GB** (measured by controlled A/B), and **VSCode's close-delay was a 1,057 MB
`state.vscdb` flush** caused by the Claude Code session cache (286 MB row rebuilt from 243
sessions). We fixed all three, reclaimed ~48 GB disk, cut installed VSCode extensions
48 → 18, and built a move-only chat archive system with INDEX.md. Several early theories
were **wrong** (repo size, "memory pressure", Safari being "light") — every wrong turn and
its correction is recorded below because the honesty discipline is part of the product DNA.

---

## 2. Measured findings & fixes (all verified)

| Problem                             | Root cause (measured)                                                                                                                                              | Fix                                                                                               | Result                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Mac slow "for some time"            | `pmset -g` → `lowpowermode 1` (throttles CPU on Apple Silicon)                                                                                                     | Settings → Battery → LPM "Never"/"Only on Battery"                                                | Full CPU speed                              |
| VSCode close-delay + "saving" popup | `state.vscdb` 534 MB + 523 MB backup copied on every close; inside it one row `agentSessions.model.cache` = 286 MB (243 sessions × ~1.2 MB metadata each)          | Archive old chats (move-only) + `VACUUM` with VSCode closed                                       | 1,057 MB → **19 MB**; close instant         |
| Chats silently disappearing         | Claude Code default `cleanupPeriodDays` = 30 auto-deletes transcripts                                                                                              | Set `"cleanupPeriodDays": 3650` in `~/.claude/settings.json`                                      | History preserved                           |
| Chrome RAM                          | Extensions ran 7 extra renderer processes; A/B measured: all-ext 4.02 GB vs no-ext 2.64 GB                                                                         | User disabled unused extensions                                                                   | −1.38 GB; 2 adblock ext alone = ~470 MB     |
| Battery drain                       | 85% max capacity @ 408 cycles (wear, unfixable) + Chrome audio tab holding `NoIdleSleepAssertion`                                                                  | Explained; audio assertion only blocks _idle_ sleep, never lid-close                              | Expectations corrected                      |
| Disk                                | Dev caches: npm 9.2G, uv 9.9G, ollama 13G, lmstudio 7.5G, docker 10G, gradle 5.1G, anaconda 6.3G, android 24G…                                                     | Manual cleanup (~39 GB) + Docker full uninstall (7.4 GB) + 221 orphan VSCode workspaces (2.35 GB) | 129 → 177 GB free                           |
| VSCode startup                      | 48 extensions, 18 activating at startup (incl. 3 AI assistants: Claude + Continue + ChatGPT; Continue indexes the whole workspace)                                 | Uninstalled to 18                                                                                 | Startup halved (subjective; user confirmed) |
| Repo-side                           | 195k files on disk vs 3.6k tracked; `server/dist` (2,214 files) rewritten every rebuild, default watcherExclude insufficient; git: 38 packs + 18,495 loose objects | `.vscode/settings.json` watcher/search/TS excludes; `git gc` → 2 packs, 0 loose, 207→119 MB       | Watcher storms gone                         |
| Boot-time load spikes               | Spotlight full re-index (20 mdworkers, 84% CPU) + `mobileassetd` after boot — transient, NOT a bug                                                                 | None needed (one-time settle)                                                                     | Understood                                  |
| watchman                            | Launch agent watching the 195k-file repo; nothing uses it (jest runs `--watchman=false`)                                                                           | Optional: `launchctl unload` + `brew uninstall watchman`                                          | 88 MB dormant                               |

### Wrong turns (kept on purpose — product lessons)

1. **Blamed repo size first** — the real cause was LPM. _Lesson: disk/files ≠ speed; measure latency first._
2. **Read "0.84 GB free" as memory pressure** — macOS free-RAM is near-zero by design; the
   real signals are `vm.swapusage` and `memory_pressure`. Swap was 0.00 MB the whole time.
3. **Set 8 GB tsserver heap for a process that wasn't even running** — reverted.
4. **"Safari is 15× lighter"** — grep for "Safari" missed all `com.apple.WebKit.WebContent`
   processes; correctly measured, Safari used ~2× MORE per page (218 vs 114 MB). Chrome's
   total was tab-count, not engine inefficiency.
5. **"43 renderers = 43 tabs"** — user had 3 tabs; site-isolation + (then-enabled)
   extensions explain most; evidence evaporated on Chrome restart before deep-dive finished.
   _Lesson: measure live state immediately; don't launch long investigations on volatile state._
6. **Woke watchman by querying it** (`watchman watch-list` starts the daemon) — then almost
   reported it as a live finding. _Lesson: probes must be genuinely read-only._

---

## 3. Probe catalog (build-ready recipes)

Every command below was used and interpreted in-session. `[Speed]`/`[Storage]` = honest tag.

### System (macOS)

| Probe          | Command                                                                                       | Interpretation                                                                                                     | Tag   |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| Low Power Mode | `pmset -g` → `lowpowermode`                                                                   | 1 = CPU throttled → red finding + explain tradeoff                                                                 | Speed |
| Memory truth   | `vm_stat` (free/active/inactive/wired/compressed) + `memory_pressure` + `sysctl vm.swapusage` | swap>0 = real pressure; compressed high = tight; free≈0 is NORMAL                                                  | Speed |
| Load           | `uptime` vs `sysctl -n hw.ncpu`                                                               | load > cores sustained = investigate                                                                               | Speed |
| Battery health | `system_profiler SPPowerDataType` → cycles, max capacity                                      | wear is unfixable — say so honestly                                                                                | —     |
| Sleep blockers | `pmset -g assertions`                                                                         | list per-process; explain idle-sleep vs lid-close                                                                  | —     |
| Thermal        | `pmset -g therm` + kernel_task CPU%                                                           | throttle detection                                                                                                 | Speed |
| Backup risk    | `tmutil destinationinfo`                                                                      | "No destinations configured" = flag data risk                                                                      | —     |
| Spotlight      | `mdutil -s /` + mds/mdworker CPU sum                                                          | boot re-index is transient; exclusions are GUI-only (Privacy list; `.metadata_never_index` dies on `pnpm install`) | Speed |
| Startup items  | `osascript` login items; `ls ~/Library/LaunchAgents`; `launchctl list` non-`com.apple`        | flag watchers/updaters; watchman-style: watched roots vs projects that want it                                     | Speed |

### Browser (Chrome/Chromium family)

| Probe          | Command                                                                                                                    | Interpretation                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Total + split  | `ps -Ao rss,args` grep `[G]oogle Chrome` — **beware multi-word comm truncation; group via full args, never `$NF` of comm** | renderer vs `--extension-process` vs gpu/network             |
| Extension cost | sum RSS of `--extension-process` renderers                                                                                 | shown per profile; A/B mode: snapshot → user toggles → diff  |
| Audio blocker  | `pmset -g assertions` grep Chrome "Playing audio"                                                                          | find tab via `Shift+Esc` (guide-only)                        |
| Ground truth   | Chrome Task Manager `Shift+Esc` (GUI)                                                                                      | per-tab/URL memory — CLI cannot map renderer→URL (by design) |

### Claude sessions (cross-platform — the ⭐ module)

| Probe                | Mechanic                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Per-project sessions | `~/.claude/projects/<escaped-path>/*.jsonl` — dir name is the escaped project path (`-Users-ankitjain-Documents-AvinyX-9-June`)                                                                                                                  |
| Cache size + titles  | workspace's `state.vscdb` → `ItemTable` key `agentSessions.model.cache` = JSON array; each entry: `resource` ("claude-code:/<session-uuid>"), `label` (title), `timing`, `changes` (the bloat)                                                   |
| Projection           | ~1.2 MB cache per session (measured avg) → "keep N days ⇒ cache ≈ X MB"                                                                                                                                                                          |
| Archive              | **move-only** `.jsonl` older than cutoff (capture mtime BEFORE move — we hit that bug) → `~/claude-history-archive/<project>/`; regenerate `INDEX.md` (date \| title \| file) from cache-titles map, archive dir as source of truth (idempotent) |
| Restore              | move file back + restart VSCode; guard: retention must be raised or restored chats re-expire                                                                                                                                                     |
| Retention            | `~/.claude/settings.json` `"cleanupPeriodDays"` (default 30 = silent deletion!)                                                                                                                                                                  |

### VSCode (cross-platform paths differ only)

| Probe                | Mechanic                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace map        | `<VSCode user dir>/workspaceStorage/<hash>/workspace.json` → `folder` URI → join with Claude project dirs                                                                                                                                                                                                                         |
| Orphans              | workspace.json folder does not exist on disk → safe delete (found 221 = 2.35 GB)                                                                                                                                                                                                                                                  |
| state.vscdb analyzer | SQLite `ItemTable`; biggest keys; **file size ≫ data size ⇒ needs VACUUM** (SQLite never shrinks the file when rows shrink)                                                                                                                                                                                                       |
| VACUUM flow          | requires VSCode fully closed. Verified safe: cache row delete is rebuilt on restart — VSCode core `loadCachedSessions()` does `if(!o)return[]` then providers re-report and `saveCachedSessions` re-writes. **A tray app can wait for VSCode to quit and VACUUM automatically — the key advantage of doing this outside VSCode.** |
| Extension audit      | `code --list-extensions`; per-extension `package.json` `activationEvents`: `*` = worst, `onStartupFinished` = startup cost; detect duplicates (2× Astro found), AI-assistant stacking (3 found)                                                                                                                                   |
| Ground truth timings | GUI-only: "Developer: Startup Performance", "Developer: Show Running Extensions", Process Explorer                                                                                                                                                                                                                                |
| Repo hygiene         | files-on-disk vs `git ls-files` ratio; `git count-objects -vH` (packs/loose) → `git gc`                                                                                                                                                                                                                                           |

### Dev storage (cross-platform)

| Probe                | Mechanic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Safety class         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| node_modules sweep   | `find` top-level `node_modules` (121 found); classify by project activity: Downloads/6-month-dead = pre-checked, 30d-stale = optional, active = **locked**                                                                                                                                                                                                                                                                                                                                                                                                   | regenerable          |
| pnpm store           | hardlink check (`stat` link count) → `pnpm store prune`, never raw delete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | caution              |
| Docker               | gate on `docker system df -v` volumes EMPTY before uninstall; official uninstaller then `/Applications/Docker.app`, `~/Library/Containers/com.docker.docker` (`Docker.raw` is the big one), `~/.docker`                                                                                                                                                                                                                                                                                                                                                      | gated                |
| Never-touch examples | `.ollama` (project evals used qwen2.5-coder:3b), `anaconda3` (wired in `.zshrc` conda-init block + envs), `~/.cache/prisma`                                                                                                                                                                                                                                                                                                                                                                                                                                  | **check refs first** |
| Safe list            | npm cache, uv cache, huggingface, puppeteer, gradle caches, DerivedData, old simulators                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | regenerable          |
| Ollama models        | READ: manifests dir directly (`~/.ollama/models/manifests/registry.ollama.ai/library/<model>/<tag>`), never the CLI on scan (`ollama list` auto-starts the daemon — same trap as watchman). Size = blobs referenced by manifest, **deduped across models** (report unique vs shared bytes). Last-pulled = manifest mtime. DELETE: `ollama rm <model>` only (handles blob refcounting) — user-click only. In-session: 13 GB found; `qwen2.5-coder:3b` was load-bearing (Flata AI golden evals) — always offer a "referenced in projects?" check before delete | check refs first     |

---

## 4. Product design agreed (Nexus Doctor)

**Philosophy: clean, simple, straightforward, light, native. NOT over-complex.**

- **Two pages only.**
  1. **Doctor** — scope chips (System/Claude/VSCode/Browser/Disk/Startup, default all) +
     one **Scan** button (+ separate **Deep scan** toggle for the slow node_modules sweep) →
     severity-sorted findings report. Healthy items = one green line, no dashboard clutter.
  2. **Claude Archiver** — the only stateful page: per-project table, archive-cutoff
     selector with live cache projection, archive size shown, restore-from-archive list,
     editable `cleanupPeriodDays`, auto-archive toggle.
- **Each finding = one line + one primary action** (Fix = automated, or Guide = GUI steps).
- **Before/After built into every fix**: snapshot → action → diff shown on the same card. Session log kept.
- **Honest tags**: `[Speed]` vs `[Storage]` on every finding — disk cleanup does NOT make a
  machine faster (measured lesson of this session); the app never claims otherwise.
- **Auto-archive via tray**: daily/at-launch job archives per settings, notifies
  ("9-June: 12 chats archived"); **deferred VACUUM** runs when the tray detects VSCode quit.
- **Per-project everywhere**: Claude projects dir ↔ workspaceStorage joined into one table
  (project | chats | cache MB | state.vscdb MB | verdict); orphans flagged red.
- **Safety rules (non-negotiable)**: scan is read-only; every mutation behind an explicit
  click; move > delete as default; backup before any DB edit; verify target exists/empty
  before destructive ops; probes must not wake daemons (watchman lesson).

### Windows-compat from day one (build later, cost nothing now)

1. Every scan item is a **Probe** `{ id, platforms: [...], run() }` — registry filters by OS.
2. **Runtime capability flags** in addition to platform tags: `availability()` per probe —
   if the device doesn't have the feature (e.g. LPM), the finding simply never renders.
   Works both directions (Windows-only features hidden on Mac).
3. All paths through one `paths.rs` (`dirs` crate): VSCode user dir, Claude dir (`~/.claude`
   is the same on Windows), archive dir. No hardcoded `/Users/...` anywhere.
4. UI is platform-blind: findings are pure data (severity/title/explain/action).
5. Shared for free on Windows later: Claude Archiver (~100%), VSCode Doctor (~95%),
   node_modules/dev-storage (~100%), SQLite via rusqlite. Needs Windows twins: System
   probes (`powercfg`, Get-Process, Task Scheduler, Windows Search).

---

## 5. Related artifacts on this machine

- Archive system (live): `~/claude-history-archive/9-June/` — 223 chats + `INDEX.md`;
  restore = move back + VSCode restart.
- Retention: `~/.claude/settings.json` → `"cleanupPeriodDays": 3650` (was default 30).
- One-shot script kept: `~/trim-vscode-state.sh` (superseded by the archive approach).
- 9-June repo: `.vscode/settings.json` watcher/search/TS excludes (this session).
- Claude memory: `claude-chat-archive-system.md` in the 9-June project memory dir.
- The plan for building all of this: **`docs/doctor/PLAN.md`** (this repo) — maintained here.
