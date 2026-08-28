// Phase 3 — VSCode Doctor: the app's origin story. Two probes + two fixes:
//   vscode_orphans   → workspaceStorage dirs whose project folder is gone
//                      (221 dirs / 2.35 GB in the original session)
//   state_db_bloat   → state.vscdb with reclaimable free pages
//                      (1,057 MB → 19 MB after VACUUM in the original session)
// Probes are strictly read-only (rusqlite opens READ_ONLY). Fixes are their
// own arg-less commands — the frontend never supplies a path — and both are
// journaled. Fail-safe everywhere: unrecognized shapes are skipped, never
// guessed at.

use super::{paths, Finding, Platform, Probe, Scope, Severity, Tag};
use crate::error::{AppError, AppResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const MACOS: &[Platform] = &[Platform::MacOs];

fn available() -> bool {
    paths::vscode_user_dir().is_some_and(|d| d.is_dir())
}

pub const ORPHANS: Probe = Probe {
    id: "vscode_orphans",
    scope: Scope::Vscode,
    platforms: MACOS,
    available,
    run: run_orphans,
};

pub const DB_BLOAT: Probe = Probe {
    id: "state_db_bloat",
    scope: Scope::Vscode,
    platforms: MACOS,
    available,
    run: run_db_bloat,
};

// --- orphan workspaceStorage ----------------------------------------------------

struct OrphanScan {
    dirs: Vec<PathBuf>,
    bytes: u64,
}

/// workspace.json → the folder this cache belongs to. Only plain local
/// `file://` single-folder workspaces qualify — multi-root and remote entries
/// are skipped (fail-safe: can't cheaply verify → never flag).
fn folder_from_workspace_json(raw: &str) -> Option<PathBuf> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let uri = v.get("folder")?.as_str()?;
    let path = uri.strip_prefix("file://")?;
    Some(PathBuf::from(percent_decode(path)))
}

/// Just enough percent-decoding for file:// URIs (%20 etc.).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn scan_orphans() -> Option<OrphanScan> {
    let root = paths::vscode_workspace_storage()?;
    let mut dirs = Vec::new();
    let mut bytes = 0u64;
    for entry in fs::read_dir(root).ok()?.filter_map(Result::ok) {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let Ok(raw) = fs::read_to_string(dir.join("workspace.json")) else {
            continue; // no workspace.json → not a plain workspace cache, skip
        };
        let Some(folder) = folder_from_workspace_json(&raw) else {
            continue;
        };
        // External volumes may just be unplugged — never treat as orphaned.
        if folder.starts_with("/Volumes") || folder.exists() {
            continue;
        }
        bytes += dir_size(&dir);
        dirs.push(dir);
    }
    Some(OrphanScan { dirs, bytes })
}

fn run_orphans() -> Vec<Finding> {
    let Some(scan) = scan_orphans() else {
        return vec![];
    };
    let n = scan.dirs.len();
    if n == 0 {
        return vec![Finding {
            probe_id: ORPHANS.id,
            scope: ORPHANS.scope,
            severity: Severity::Green,
            tag: Tag::Storage,
            summary: "No orphan VSCode workspace caches".into(),
            explain: "Every workspaceStorage entry still has its project folder.".into(),
            guide: None,
            fix: None,
        }];
    }
    vec![Finding {
        probe_id: ORPHANS.id,
        scope: ORPHANS.scope,
        severity: Severity::Yellow,
        tag: Tag::Storage,
        summary: format!(
            "{n} orphan workspace cache{} · {}",
            if n == 1 { "" } else { "s" },
            fmt_mb(scan.bytes)
        ),
        explain: "VSCode keeps a cache folder per workspace it has ever opened. These belong \
                  to project folders that no longer exist, so nothing can ever use them again \
                  (projects on external volumes are excluded from this count)."
            .into(),
        guide: None,
        fix: Some("vscode_cleanup_orphans".into()),
    }]
}

// --- state.vscdb bloat --------------------------------------------------------------

/// Reclaimable bytes worth mentioning / worth alarm.
const BLOAT_YELLOW: u64 = 50 * 1024 * 1024;
const BLOAT_RED: u64 = 500 * 1024 * 1024;

fn classify_bloat(reclaimable: u64) -> Option<Severity> {
    if reclaimable >= BLOAT_RED {
        Some(Severity::Red)
    } else if reclaimable >= BLOAT_YELLOW {
        Some(Severity::Yellow)
    } else {
        None
    }
}

/// Free-page bytes a VACUUM would reclaim. Read-only open; None = unreadable
/// or not a SQLite db (fail-safe: skip, never guess).
fn db_reclaimable(db: &Path) -> Option<u64> {
    let conn = rusqlite::Connection::open_with_flags(
        db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()?;
    let page_size: u64 = conn.query_row("PRAGMA page_size", [], |r| r.get(0)).ok()?;
    let freelist: u64 = conn
        .query_row("PRAGMA freelist_count", [], |r| r.get(0))
        .ok()?;
    Some(freelist * page_size)
}

/// Every state.vscdb we know about: each workspace's + the global one.
fn all_state_dbs() -> Vec<PathBuf> {
    let mut dbs = Vec::new();
    if let Some(root) = paths::vscode_workspace_storage() {
        if let Ok(rd) = fs::read_dir(root) {
            for entry in rd.filter_map(Result::ok) {
                let db = entry.path().join("state.vscdb");
                if db.is_file() {
                    dbs.push(db);
                }
            }
        }
    }
    if let Some(global) = paths::vscode_global_state_db() {
        if global.is_file() {
            dbs.push(global);
        }
    }
    dbs
}

fn run_db_bloat() -> Vec<Finding> {
    let mut total_reclaimable = 0u64;
    let mut bloated = 0usize;
    for db in all_state_dbs() {
        if let Some(r) = db_reclaimable(&db) {
            if classify_bloat(r).is_some() {
                bloated += 1;
                total_reclaimable += r;
            }
        }
    }
    if bloated == 0 {
        return vec![Finding {
            probe_id: DB_BLOAT.id,
            scope: DB_BLOAT.scope,
            severity: Severity::Green,
            tag: Tag::Speed,
            summary: "VSCode state databases are compact".into(),
            explain: "No state.vscdb is carrying significant free pages.".into(),
            guide: None,
            fix: None,
        }];
    }
    vec![Finding {
        probe_id: DB_BLOAT.id,
        scope: DB_BLOAT.scope,
        severity: classify_bloat(total_reclaimable).unwrap_or(Severity::Yellow),
        tag: Tag::Speed,
        summary: format!(
            "{bloated} bloated state.vscdb — {} reclaimable via VACUUM",
            fmt_mb(total_reclaimable)
        ),
        explain: "SQLite never shrinks a file when rows shrink, and VSCode copies this file on \
                  every window close — a bloated one makes closing VSCode visibly slow (the \
                  original case: 1,057 MB → 19 MB). VACUUM rebuilds it compactly; if VSCode is \
                  open you'll be asked before it's closed."
            .into(),
        guide: None,
        fix: Some("vscode_vacuum".into()),
    }]
}

// --- fixes ------------------------------------------------------------------------

/// Fix: delete orphan workspaceStorage dirs. Re-scans at fix time (never
/// trusts a stale finding), refuses paths outside workspaceStorage, journaled.
pub fn cleanup_orphans() -> AppResult<String> {
    let root = paths::vscode_workspace_storage()
        .ok_or_else(|| AppError::NotFound("VSCode not found".into()))?;
    let scan = scan_orphans().ok_or_else(|| AppError::NotFound("VSCode not found".into()))?;
    let (mut removed, mut failed) = (0usize, 0usize);
    for dir in &scan.dirs {
        // Defense in depth: only ever delete direct children of workspaceStorage.
        if dir.parent() != Some(root.as_path()) || fs::remove_dir_all(dir).is_err() {
            failed += 1;
        } else {
            removed += 1;
        }
    }
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"vscodeCleanupOrphans","removed":{removed},"failed":{failed},"bytes":{}}}"#,
        super::claude::now_epoch(),
        scan.bytes
    ));
    Ok(format!(
        "Removed {removed} orphan cache{} · freed {}{}",
        if removed == 1 { "" } else { "s" },
        fmt_mb(scan.bytes),
        if failed > 0 {
            format!(" ({failed} failed)")
        } else {
            String::new()
        }
    ))
}

/// Fix: VACUUM every bloated state.vscdb. Gated twice: refuses while VSCode
/// runs (process check) and SQLite's own locking is the backstop. VACUUM is
/// atomic and content-preserving — the one DB write this app does without a
/// copy first (a .bak of a 1 GB file would double the problem being fixed).
/// Also drops VSCode's own stale `state.vscdb.backup` next to each vacuumed
/// db — VSCode recreates it on next close.
pub fn vacuum_bloated() -> AppResult<String> {
    if state_dbs_in_use() {
        return Err(AppError::Forbidden(
            "Close VSCode first — it holds these databases open.".into(),
        ));
    }
    let mut lines = Vec::new();
    let mut freed = 0u64;
    for db in all_state_dbs() {
        let Some(reclaimable) = db_reclaimable(&db) else {
            continue;
        };
        if classify_bloat(reclaimable).is_none() {
            continue;
        }
        let before = db.metadata().map(|m| m.len()).unwrap_or(0);
        let name = db
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "state.vscdb".into());
        match vacuum_db(&db) {
            Ok(()) => {
                let after = db.metadata().map(|m| m.len()).unwrap_or(before);
                freed += before.saturating_sub(after);
                let _ = fs::remove_file(db.with_extension("vscdb.backup"));
                lines.push(format!("{name}: {} → {}", fmt_mb(before), fmt_mb(after)));
            }
            Err(e) => lines.push(format!("{name}: skipped ({e})")),
        }
    }
    if lines.is_empty() {
        return Ok("Nothing needed a VACUUM.".into());
    }
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"vscodeVacuum","freedBytes":{freed},"dbs":{}}}"#,
        super::claude::now_epoch(),
        lines.len()
    ));
    Ok(format!("Freed {} — {}", fmt_mb(freed), lines.join("; ")))
}

/// SIGTERM grace (VSCode flushes state + hot-exit backups here), then the
/// short wait after SIGKILL for the kernel to drop the file handles.
const TERM_GRACE: Duration = Duration::from_secs(8);
const KILL_GRACE: Duration = Duration::from_secs(4);
const QUIT_POLL: Duration = Duration::from_millis(300);

/// Every live process running out of the VSCode bundle — main app + helpers.
/// Matched on the *executable path* from `ps`, not `pgrep -f`: pgrep can't
/// read the main `Contents/MacOS/Code` process's argv on macOS, so it misses
/// the one process that actually matters.
fn vscode_pids() -> Vec<String> {
    let Ok(out) = std::process::Command::new("ps")
        .args(["-axo", "pid=,comm="])
        .output()
    else {
        return Vec::new();
    };
    parse_vscode_pids(&String::from_utf8_lossy(&out.stdout))
}

/// `ps -axo pid=,comm=` lines → pids of VSCode-bundle processes.
fn parse_vscode_pids(ps_out: &str) -> Vec<String> {
    ps_out
        .lines()
        .filter(|l| l.contains("/Visual Studio Code.app/"))
        .filter_map(|l| l.split_whitespace().next().map(str::to_owned))
        .collect()
}

fn signal_pids(sig: &str, pids: &[String]) {
    if !pids.is_empty() {
        let _ = std::process::Command::new("kill")
            .arg(sig)
            .args(pids)
            .status();
    }
}

/// True once nothing holds the state DBs open, false if the deadline passes.
fn wait_released(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        if !state_dbs_in_use() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(QUIT_POLL);
    }
}

/// Close VSCode for real. SIGTERM first so VSCode gets to flush state and
/// hot-exit backups; SIGKILL only for whatever ignores that — a modal
/// "save your changes?" sheet must not be able to veto this, which is the
/// whole point of the user having confirmed a *force* quit.
pub fn force_quit_vscode() -> AppResult<()> {
    signal_pids("-TERM", &vscode_pids());
    if wait_released(TERM_GRACE) {
        return Ok(());
    }
    signal_pids("-KILL", &vscode_pids());
    if wait_released(KILL_GRACE) {
        return Ok(());
    }
    Err(AppError::Forbidden(
        "Something is still holding the VSCode databases open. Close it and try again.".into(),
    ))
}

fn vacuum_db(db: &Path) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db).map_err(|e| e.to_string())?;
    conn.busy_timeout(std::time::Duration::from_millis(0))
        .map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM").map_err(|e| e.to_string())
}

/// Is **VSCode** holding a state.vscdb open — the question the VACUUM gate
/// needs answered. Two earlier versions of this check were wrong:
///   * `pgrep -f "Visual Studio Code.app"` matched a stray
///     `chrome_crashpad_handler` left behind by an older VSCode (reparented to
///     PID 1, days old), so the fix was blocked forever — and it can't read
///     the main `Contents/MacOS/Code` process's argv on macOS anyway, so it
///     never saw the process that actually holds the file.
///   * plain "does *anything* hold these open" counted **our own pid**: a
///     Doctor scan has ~300 read-only sqlite handles open for its PRAGMA
///     reads, so a poll landing inside a scan (or a passing `mdworker`) would
///     report VSCode as still there right after we killed it — the force-quit
///     would then "fail" with nothing left to kill.
///
/// So: holders ∩ VSCode processes. Anything else with the file open is left
/// to VACUUM's own SQLITE_BUSY backstop, which is what it's for.
/// ponytail: fails open if lsof is missing — same backstop covers it.
pub fn state_dbs_in_use() -> bool {
    let dbs = all_state_dbs();
    if dbs.is_empty() {
        return false;
    }
    let Ok(out) = std::process::Command::new("lsof")
        .arg("-t")
        .arg("--")
        .args(&dbs)
        .output()
    else {
        return false;
    };
    any_holder_is_vscode(&String::from_utf8_lossy(&out.stdout), &vscode_pids())
}

/// `lsof -t` pids ∩ VSCode pids. Whole-token compare — "634041" is not "63404".
fn any_holder_is_vscode(lsof_out: &str, vscode_pids: &[String]) -> bool {
    lsof_out
        .split_whitespace()
        .any(|pid| vscode_pids.iter().any(|v| v == pid))
}

// --- extension audit ----------------------------------------------------------------

pub const EXTENSION_AUDIT: Probe = Probe {
    id: "extension_audit",
    scope: Scope::Vscode,
    platforms: MACOS,
    available: extensions_available,
    run: run_extension_audit,
};

fn extensions_available() -> bool {
    paths::vscode_extensions_dir().is_some_and(|d| d.is_dir())
}

/// One assistant per publisher counts once (copilot + copilot-chat = one).
const AI_KEYWORDS: &[&str] = &[
    "copilot", "claude", "continue", "codeium", "tabnine", "chatgpt", "cline", "cody", "amazon-q",
];
const MAX_NAMED: usize = 8;

pub(crate) struct ExtMeta {
    pub(crate) id: String,
    display: String,
    publisher: String,
    star: bool,
    startup: bool,
}

/// "auto-rename-tag" → "Auto Rename Tag" (fallback when no displayName).
fn title_case(name: &str) -> String {
    name.split(['-', '_', '.'])
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Static package.json scan — never spawns the `code` CLI. `nls` is the
/// optional package.nls.json for resolving "%key%" display names.
fn parse_extension_manifest(raw: &str, nls: Option<&str>) -> Option<ExtMeta> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let name = v.get("name")?.as_str()?.to_lowercase();
    let publisher = v.get("publisher")?.as_str()?.to_lowercase();
    let events: Vec<&str> = v
        .get("activationEvents")
        .and_then(serde_json::Value::as_array)
        .map(|a| a.iter().filter_map(serde_json::Value::as_str).collect())
        .unwrap_or_default();
    let display = v
        .get("displayName")
        .and_then(serde_json::Value::as_str)
        .and_then(
            |dn| match dn.strip_prefix('%').and_then(|s| s.strip_suffix('%')) {
                // Localized: look the key up in package.nls.json.
                Some(key) => nls
                    .and_then(|n| serde_json::from_str::<serde_json::Value>(n).ok())
                    .and_then(|n| {
                        n.get(key)
                            .and_then(serde_json::Value::as_str)
                            .map(String::from)
                    }),
                None => Some(dn.to_string()),
            },
        )
        .unwrap_or_else(|| title_case(&name));
    Some(ExtMeta {
        id: format!("{publisher}.{name}"),
        display,
        publisher,
        star: events.contains(&"*"),
        startup: events.contains(&"onStartupFinished"),
    })
}

struct Audit {
    total: usize,
    star: Vec<String>,
    startup: usize,
    ai: Vec<String>,
    dups: Vec<String>,
}

fn audit(metas: &[ExtMeta]) -> Audit {
    let mut seen = std::collections::HashMap::<&str, u32>::new();
    let mut ai_publishers = std::collections::HashMap::<&str, &str>::new();
    for m in metas {
        *seen.entry(m.id.as_str()).or_default() += 1;
        if AI_KEYWORDS.iter().any(|k| m.id.contains(k)) {
            ai_publishers.entry(m.publisher.as_str()).or_insert(&m.id);
        }
    }
    let mut dups: Vec<String> = seen
        .iter()
        .filter(|(_, n)| **n > 1)
        .map(|(id, _)| (*id).to_string())
        .collect();
    dups.sort();
    let mut ai: Vec<String> = ai_publishers.values().map(|id| (*id).to_string()).collect();
    ai.sort();
    let mut star: Vec<String> = metas
        .iter()
        .filter(|m| m.star)
        .map(|m| m.id.clone())
        .collect();
    star.sort();
    star.dedup();
    Audit {
        total: metas.len(),
        star,
        startup: metas.iter().filter(|m| m.startup).count(),
        ai,
        dups,
    }
}

/// Every installed extension (also the validation set for uninstalls).
pub(crate) fn installed_extensions() -> Vec<ExtMeta> {
    let Some(dir) = paths::vscode_extensions_dir() else {
        return vec![];
    };
    let Ok(rd) = fs::read_dir(dir) else {
        return vec![];
    };
    rd.filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.is_dir()
                && !p
                    .file_name()
                    .is_some_and(|n| n.to_string_lossy().starts_with('.'))
        })
        .filter_map(|p| {
            let raw = fs::read_to_string(p.join("package.json")).ok()?;
            let nls = fs::read_to_string(p.join("package.nls.json")).ok();
            parse_extension_manifest(&raw, nls.as_deref())
        })
        .collect()
}

/// VSCode's own CLI — the sanctioned uninstall path (no internals touched).
fn code_cli() -> Option<PathBuf> {
    let p = PathBuf::from("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code");
    p.is_file().then_some(p)
}

fn activation_label(m: &ExtMeta) -> &'static str {
    if m.star {
        "always-on (*)"
    } else if m.startup {
        "activates at startup"
    } else {
        "loads on demand"
    }
}

fn run_extension_audit() -> Vec<Finding> {
    let metas = installed_extensions();
    if metas.is_empty() {
        return vec![];
    }
    let a = audit(&metas);

    let mut parts = Vec::new();
    if !a.star.is_empty() {
        parts.push(format!(
            "Always-on (`*` activation — the worst kind): {}.",
            a.star.join(", ")
        ));
    }
    if a.ai.len() > 1 {
        parts.push(format!(
            "AI assistants stacked: {} — each one indexes your workspace and runs its own \
             processes; keep one.",
            a.ai.iter()
                .take(MAX_NAMED)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if !a.dups.is_empty() {
        parts.push(format!("Installed more than once: {}.", a.dups.join(", ")));
    }
    parts.push(
        "Ground truth is GUI-only: run \"Developer: Startup Performance\" inside VSCode."
            .to_string(),
    );

    let issues = !a.star.is_empty() || a.ai.len() > 1 || !a.dups.is_empty();
    let mut out = vec![Finding {
        probe_id: EXTENSION_AUDIT.id,
        scope: EXTENSION_AUDIT.scope,
        severity: if issues {
            Severity::Yellow
        } else {
            Severity::Green
        },
        tag: Tag::Speed,
        summary: format!(
            "{} extensions · {} activate at startup · {} AI assistant{}",
            a.total,
            a.startup,
            a.ai.len(),
            if a.ai.len() == 1 { "" } else { "s" }
        ),
        explain: parts.join(" "),
        guide: issues.then(|| {
            vec![
                "In VSCode: Extensions panel → disable what you don't use (\"Disable \
                 (Workspace)\" keeps it available elsewhere)"
                    .into(),
                "Run \"Developer: Show Running Extensions\" for live per-extension cost".into(),
            ]
        }),
        fix: None,
    }];

    // One row per extension, uninstallable right here (VSCode's own CLI).
    let can_uninstall = code_cli().is_some();
    let mut seen = std::collections::HashSet::new();
    for m in &metas {
        if !seen.insert(m.id.as_str()) {
            continue; // multi-version duplicates listed once
        }
        out.push(Finding {
            probe_id: EXTENSION_AUDIT.id,
            scope: EXTENSION_AUDIT.scope,
            severity: if m.star {
                Severity::Yellow
            } else {
                Severity::Green
            },
            tag: Tag::Speed,
            summary: format!("{} · {}", m.display, activation_label(m)),
            explain: format!(
                "{} — uninstalling runs VSCode's own CLI (`code --uninstall-extension`); \
                 your settings survive and it can be reinstalled from the Marketplace \
                 anytime (a running VSCode applies the change after a restart). A \
                 persistent disable-only isn't safely automatable from outside VSCode — \
                 use its Extensions panel for that.",
                m.id
            ),
            guide: None,
            fix: can_uninstall.then(|| format!("vscode_ext_rm:{}", m.id)),
        });
    }
    out
}

/// Native-confirm copy for an extension uninstall.
pub fn fix_confirmation_ext(id: &str) -> (String, String) {
    (
        format!("Uninstall {id}?"),
        "Runs VSCode's own CLI. Settings survive; reinstall anytime from the Marketplace. \
         A running VSCode applies the change after a restart."
            .into(),
    )
}

/// Uninstall via `code --uninstall-extension`, validated against the ACTUAL
/// installed set first — the frontend string is never trusted.
pub fn uninstall_extension(id: &str) -> AppResult<String> {
    if !installed_extensions().iter().any(|m| m.id == id) {
        return Err(AppError::NotFound(format!("no such extension: {id}")));
    }
    let cli = code_cli()
        .ok_or_else(|| AppError::NotFound("VSCode CLI not found in the app bundle".into()))?;
    let out = std::process::Command::new(cli)
        .args(["--uninstall-extension", id])
        .output()
        .map_err(|e| AppError::Shell(format!("code CLI: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Shell(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"vscodeExtUninstall","extension":"{id}"}}"#,
        super::claude::now_epoch()
    ));
    Ok(format!(
        "Uninstalled {id} — restart VSCode to apply; reinstall anytime from the Marketplace"
    ))
}

// --- Claude session cache (the workspaceStorage ↔ Claude project join) --------------

/// VSCode's per-workspace Claude session cache: session-uuid → chat title,
/// plus how many bytes the cache row itself occupies (the state.vscdb bloat
/// driver — ~1.2 MB per session measured in the original case).
pub struct SessionCache {
    pub titles: std::collections::HashMap<String, String>,
    pub bytes: u64,
}

/// The ItemTable key VSCode stores the cache under. Undocumented internal —
/// guarded by `parse_session_cache`'s fail-safe (unrecognized → None, never guess).
const SESSION_CACHE_KEY: &str = "agentSessions.model.cache";

/// Every workspaceStorage dir ↔ the local folder it belongs to.
pub fn workspace_folder_map() -> Vec<(PathBuf, PathBuf)> {
    let Some(root) = paths::vscode_workspace_storage() else {
        return vec![];
    };
    let Ok(rd) = fs::read_dir(root) else {
        return vec![];
    };
    rd.filter_map(Result::ok)
        .filter_map(|e| {
            let dir = e.path();
            let raw = fs::read_to_string(dir.join("workspace.json")).ok()?;
            let folder = folder_from_workspace_json(&raw)?;
            Some((dir, folder))
        })
        .collect()
}

/// Titles for the workspace that has `folder` open — None when VSCode never
/// opened it, has no cache row, or the row's shape is unrecognized.
pub fn session_cache_for_folder(folder: &Path) -> Option<SessionCache> {
    let ws = workspace_folder_map()
        .into_iter()
        .find(|(_, f)| f == folder)?
        .0;
    session_cache_in(&ws)
}

pub fn session_cache_in(ws_dir: &Path) -> Option<SessionCache> {
    let raw = read_item(&ws_dir.join("state.vscdb"), SESSION_CACHE_KEY)?;
    parse_session_cache(&raw)
}

/// Read one ItemTable value (TEXT or BLOB) read-only.
fn read_item(db: &Path, key: &str) -> Option<String> {
    let conn = rusqlite::Connection::open_with_flags(
        db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()?;
    let value: rusqlite::types::Value = conn
        .query_row("SELECT value FROM ItemTable WHERE key = ?1", [key], |r| {
            r.get(0)
        })
        .ok()?;
    match value {
        rusqlite::types::Value::Text(s) => Some(s),
        rusqlite::types::Value::Blob(b) => Some(String::from_utf8_lossy(&b).into_owned()),
        _ => None,
    }
}

/// Contract: a JSON array of entries with `resource: "claude-code:/<uuid>"` and
/// `label`. Malformed ENTRIES are skipped; a malformed TOP LEVEL returns None.
fn parse_session_cache(raw: &str) -> Option<SessionCache> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let arr = v.as_array()?;
    let mut titles = std::collections::HashMap::new();
    for item in arr {
        let Some(resource) = item.get("resource").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let Some(label) = item.get("label").and_then(serde_json::Value::as_str) else {
            continue;
        };
        if let Some(uuid) = resource.rsplit('/').next() {
            if !uuid.is_empty() {
                titles.insert(uuid.to_string(), label.to_string());
            }
        }
    }
    Some(SessionCache {
        titles,
        bytes: raw.len() as u64,
    })
}

// --- helpers -------------------------------------------------------------------------

fn dir_size(dir: &Path) -> u64 {
    let Ok(rd) = fs::read_dir(dir) else { return 0 };
    rd.filter_map(Result::ok)
        .map(|e| {
            let p = e.path();
            if p.is_dir() {
                dir_size(&p)
            } else {
                p.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}

pub(crate) fn fmt_mb(bytes: u64) -> String {
    let mb = bytes as f64 / (1024.0 * 1024.0);
    if mb >= 1024.0 {
        format!("{:.1} GB", mb / 1024.0)
    } else {
        format!("{mb:.0} MB")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_workspace_folder_uri() {
        let raw = r#"{"folder":"file:///Users/x/Documents/VSS%20Batches/C12"}"#;
        assert_eq!(
            folder_from_workspace_json(raw).unwrap(),
            PathBuf::from("/Users/x/Documents/VSS Batches/C12")
        );
        // multi-root and remote workspaces are skipped, never guessed at
        assert!(
            folder_from_workspace_json(r#"{"workspace":"file:///x.code-workspace"}"#).is_none()
        );
        assert!(folder_from_workspace_json(r#"{"folder":"vscode-remote://ssh/x"}"#).is_none());
        assert!(folder_from_workspace_json("not json").is_none());
    }

    #[test]
    fn bloat_thresholds() {
        assert_eq!(classify_bloat(10 * 1024 * 1024), None);
        assert_eq!(classify_bloat(60 * 1024 * 1024), Some(Severity::Yellow));
        assert_eq!(classify_bloat(600 * 1024 * 1024), Some(Severity::Red));
    }

    #[test]
    fn formats_sizes() {
        assert_eq!(fmt_mb(60 * 1024 * 1024), "60 MB");
        assert_eq!(fmt_mb(2415919104), "2.2 GB"); // 2304 MB = 2.25 GB, banker's rounding
    }

    fn meta(id: &str, star: bool, startup: bool) -> ExtMeta {
        let (publisher, _) = id.split_once('.').unwrap();
        ExtMeta {
            id: id.into(),
            display: id.into(),
            publisher: publisher.into(),
            star,
            startup,
        }
    }

    #[test]
    fn parses_extension_manifest() {
        let raw = r#"{"name":"Continue","publisher":"Continue","activationEvents":["*","onStartupFinished"]}"#;
        let m = parse_extension_manifest(raw, None).unwrap();
        assert_eq!(m.id, "continue.continue");
        assert!(m.star && m.startup);
        assert_eq!(m.display, "Continue", "falls back to title-cased name");
        let lazy =
            r#"{"name":"astro","publisher":"astro-build","activationEvents":["onLanguage:astro"]}"#;
        let m = parse_extension_manifest(lazy, None).unwrap();
        assert!(!m.star && !m.startup);
        assert!(parse_extension_manifest(r#"{"name":"no-publisher"}"#, None).is_none());

        // Proper names: direct displayName, and %nls% lookup with fallback.
        let named = r#"{"name":"git-graph","publisher":"mhutchie","displayName":"Git Graph"}"#;
        assert_eq!(
            parse_extension_manifest(named, None).unwrap().display,
            "Git Graph"
        );
        let localized =
            r#"{"name":"vscode-docker","publisher":"ms-azuretools","displayName":"%displayName%"}"#;
        assert_eq!(
            parse_extension_manifest(localized, Some(r#"{"displayName":"Docker"}"#))
                .unwrap()
                .display,
            "Docker"
        );
        assert_eq!(
            parse_extension_manifest(localized, None).unwrap().display,
            "Vscode Docker",
            "missing nls falls back to title-cased name"
        );
    }

    #[test]
    fn audits_stacking_and_duplicates() {
        let metas = vec![
            meta("github.copilot", false, true),
            meta("github.copilot-chat", false, true), // same publisher → one assistant
            meta("anthropic.claude-code", false, true),
            meta("continue.continue", true, false),
            meta("astro-build.astro", false, false),
            meta("astro-build.astro", false, false), // duplicate install
        ];
        let a = audit(&metas);
        assert_eq!(a.total, 6);
        assert_eq!(a.ai.len(), 3, "github + anthropic + continue");
        assert_eq!(a.star, vec!["continue.continue"]);
        assert_eq!(a.startup, 3);
        assert_eq!(a.dups, vec!["astro-build.astro"]);
    }

    #[test]
    fn parses_session_cache_contract() {
        let raw = r#"[
          {"resource":"claude-code:/6bf3f2b8-aaaa-bbbb-cccc-000000000001","label":"Fix sidebar collapse","timing":{},"changes":[]},
          {"resource":"claude-code:/6bf3f2b8-aaaa-bbbb-cccc-000000000002","label":"Add MUI tabs"},
          {"label":"entry without resource is skipped"},
          {"resource":"claude-code:/no-label-skipped"}
        ]"#;
        let cache = parse_session_cache(raw).unwrap();
        assert_eq!(cache.titles.len(), 2);
        assert_eq!(
            cache.titles["6bf3f2b8-aaaa-bbbb-cccc-000000000002"],
            "Add MUI tabs"
        );
        assert_eq!(cache.bytes, raw.len() as u64);
        // Fail-safe: unrecognized top-level shapes are refused, never guessed at.
        assert!(parse_session_cache(r#"{"not":"an array"}"#).is_none());
        assert!(parse_session_cache("garbage").is_none());
    }

    // The force-quit's target list: real `ps -axo pid=,comm=` lines. The main
    // process (no "Helper" in its name) must be in there — it's the one that
    // holds state.vscdb, and the one `pgrep -f` can't see.
    #[test]
    fn parses_vscode_pids_from_ps() {
        let ps = "\
 1310 /Applications/Visual Studio Code.app/Contents/Frameworks/Electron Framework.framework/Helpers/chrome_crashpad_handler
63404 /Applications/Visual Studio Code.app/Contents/MacOS/Code
63406 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper
  456 /Applications/Cursor.app/Contents/MacOS/Cursor
  789 /usr/libexec/secinitd";
        assert_eq!(parse_vscode_pids(ps), ["1310", "63404", "63406"]);
        assert!(parse_vscode_pids("").is_empty());
    }

    // Only VSCode's own hold blocks a VACUUM. Our own scan keeps ~300
    // read-only sqlite handles open while it runs — if that counted, the
    // force-quit would report "still open" with VSCode already dead.
    #[test]
    fn only_vscode_holders_block_the_vacuum() {
        let vs = vec!["63404".to_owned(), "63406".to_owned()];
        assert!(any_holder_is_vscode("63404\n", &vs));
        assert!(
            !any_holder_is_vscode("74067\n900\n", &vs),
            "our pid / mdworker"
        );
        assert!(!any_holder_is_vscode("", &vs), "nothing holds them");
        assert!(
            !any_holder_is_vscode("634041\n", &vs),
            "no substring matches"
        );
    }

    // Real machine, strictly read-only: both probes run without panicking and
    // the sqlite read path works against real state.vscdb files.
    // Ignored in CI (runner has no VSCode installed).
    #[test]
    #[ignore]
    fn probes_run_on_real_machine() {
        assert!(run_orphans().len() <= 1);
        assert!(run_db_bloat().len() <= 1);
        // aggregate line + one row per installed extension
        assert!(run_extension_audit().len() > 1);
        assert!(
            uninstall_extension("definitely.not-installed").is_err(),
            "unknown ids must be rejected before the CLI is ever spawned"
        );
        let _ = workspace_folder_map(); // must not panic on real workspace.json shapes
    }
}
