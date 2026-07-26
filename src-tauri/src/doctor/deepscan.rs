// Phase 4 — Deep scan: the slow sweep, ONLY ever user-triggered (never part
// of the quick scan). Two probes:
//   node_modules_sweep — top-level node_modules classified by project activity:
//     Dead (in Downloads / project untouched >6 months) · Stale (>30 days) ·
//     Active (locked — no delete is ever offered).
//   dev_caches — the safety-engine table from the original session: safe
//     regenerable caches get a one-click fix; caution items (pnpm) and gated
//     items (Docker) are guide-only; never-touch items are not listed at all.
// All sizes via `du -sk` (fast C walk); deletes re-scan at fix time and are
// journaled. Everything deleted here regenerates via the tool that made it.

use super::{paths, Finding, Platform, Probe, Scope, Severity, Tag};
use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

/// Deep-scan cancel token: the slow loops below poll it between `du` calls,
/// so a cancel takes effect within one directory measurement.
static CANCEL: AtomicBool = AtomicBool::new(false);

pub fn reset_cancel() {
    CANCEL.store(false, Ordering::Relaxed);
}
pub fn cancel() {
    CANCEL.store(true, Ordering::Relaxed);
}
pub fn is_cancelled() -> bool {
    CANCEL.load(Ordering::Relaxed)
}

const MACOS: &[Platform] = &[Platform::MacOs];

fn always() -> bool {
    true
}

pub const NODE_MODULES_SWEEP: Probe = Probe {
    id: "node_modules_sweep",
    scope: Scope::Disk,
    platforms: MACOS,
    available: always,
    run: run_node_modules,
};

pub const DEV_CACHES: Probe = Probe {
    id: "dev_caches",
    scope: Scope::Disk,
    platforms: MACOS,
    available: always,
    run: run_dev_caches,
};

pub const REGISTRY: &[Probe] = &[NODE_MODULES_SWEEP, DEV_CACHES];

/// Deep probes that apply on this machine (same filtering as the quick scan).
pub fn probes() -> Vec<&'static Probe> {
    REGISTRY
        .iter()
        .filter(|p| p.platforms.contains(&Platform::current()))
        .filter(|p| (p.available)())
        .collect()
}

// --- node_modules sweep ---------------------------------------------------------

const DEAD_DAYS: u64 = 180;
const STALE_DAYS: u64 = 30;
const MAX_NAMED: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Class {
    Dead,
    Stale,
    Active,
}

fn classify(in_downloads: bool, project_age_days: u64) -> Class {
    if in_downloads || project_age_days > DEAD_DAYS {
        Class::Dead
    } else if project_age_days > STALE_DAYS {
        Class::Stale
    } else {
        Class::Active
    }
}

/// Top-level node_modules dirs under $HOME — bounded depth, prunes Library /
/// Trash / dotdirs, never descends INTO a node_modules. Verified: ~0.2 s.
fn find_node_modules() -> Vec<PathBuf> {
    let Some(home) = paths::home() else {
        return vec![];
    };
    let h = home.to_string_lossy().into_owned();
    let out = Command::new("find")
        .args([
            h.as_str(),
            "-maxdepth",
            "6",
            "(",
            "-path",
            &format!("{h}/Library"),
            "-o",
            "-path",
            &format!("{h}/.Trash"),
            "-o",
            "-name",
            ".*",
            ")",
            "-prune",
            "-o",
            "-type",
            "d",
            "-name",
            "node_modules",
            "-print",
            "-prune",
        ])
        .output();
    out.map(|o| {
        String::from_utf8_lossy(&o.stdout)
            .lines()
            .map(PathBuf::from)
            .collect()
    })
    .unwrap_or_default()
}

/// Project activity = newest top-level entry mtime in the project dir
/// (excluding node_modules itself) — cheap and good enough to classify.
fn project_age_days(project: &Path, now: u64) -> u64 {
    let newest = std::fs::read_dir(project)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|e| e.file_name() != "node_modules")
        .filter_map(|e| e.metadata().ok())
        .filter_map(|m| super::claude::mtime_epoch(&m))
        .max()
        .unwrap_or(0);
    now.saturating_sub(newest) / 86_400
}

struct Bucket {
    count: usize,
    bytes: u64,
    names: Vec<String>,
}

impl Bucket {
    fn new() -> Self {
        Bucket {
            count: 0,
            bytes: 0,
            names: Vec::new(),
        }
    }
    fn add(&mut self, project: &Path, bytes: u64) {
        self.count += 1;
        self.bytes += bytes;
        self.names.push(
            project
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
        );
    }
    fn named(&self) -> String {
        let mut s = self
            .names
            .iter()
            .take(MAX_NAMED)
            .cloned()
            .collect::<Vec<_>>()
            .join(", ");
        if self.names.len() > MAX_NAMED {
            s.push_str(&format!(", … +{}", self.names.len() - MAX_NAMED));
        }
        s
    }
}

fn sweep() -> (Bucket, Bucket, Bucket) {
    let now = super::claude::now_epoch();
    let home = paths::home().unwrap_or_default();
    let downloads = home.join("Downloads");
    let (mut dead, mut stale, mut active) = (Bucket::new(), Bucket::new(), Bucket::new());
    for nm in find_node_modules() {
        if is_cancelled() {
            break;
        }
        let Some(project) = nm.parent().map(Path::to_path_buf) else {
            continue;
        };
        let class = classify(
            project.starts_with(&downloads),
            project_age_days(&project, now),
        );
        let bytes = du_bytes(&nm);
        match class {
            Class::Dead => dead.add(&project, bytes),
            Class::Stale => stale.add(&project, bytes),
            Class::Active => active.add(&project, bytes),
        }
    }
    (dead, stale, active)
}

fn run_node_modules() -> Vec<Finding> {
    let (dead, stale, active) = sweep();
    let mut out = Vec::new();
    if dead.count > 0 {
        out.push(Finding {
            probe_id: NODE_MODULES_SWEEP.id,
            scope: Scope::Disk,
            severity: Severity::Yellow,
            tag: Tag::Storage,
            summary: format!(
                "{} dead node_modules · {} (Downloads / untouched >6 months)",
                dead.count,
                super::vscode::fmt_mb(dead.bytes)
            ),
            explain: format!(
                "Projects: {}. Nothing has touched these in months (or they live in \
                 Downloads) — deleting is safe, they regenerate on the next install.",
                dead.named()
            ),
            guide: None,
            fix: Some("deep_dead_node_modules".into()),
        });
    }
    if stale.count > 0 {
        out.push(Finding {
            probe_id: NODE_MODULES_SWEEP.id,
            scope: Scope::Disk,
            severity: Severity::Yellow,
            tag: Tag::Storage,
            summary: format!(
                "{} stale node_modules · {} (untouched 1–6 months)",
                stale.count,
                super::vscode::fmt_mb(stale.bytes)
            ),
            explain: format!(
                "Projects: {}. Might still be in rotation — delete only if you're not \
                 coming back soon; an install brings them back.",
                stale.named()
            ),
            guide: None,
            fix: Some("deep_stale_node_modules".into()),
        });
    }
    out.push(Finding {
        probe_id: NODE_MODULES_SWEEP.id,
        scope: Scope::Disk,
        severity: Severity::Green,
        tag: Tag::Storage,
        summary: if active.count > 0 {
            format!(
                "{} active node_modules · {} (locked — never offered for deletion)",
                active.count,
                super::vscode::fmt_mb(active.bytes)
            )
        } else {
            "No active node_modules".into()
        },
        explain: "Projects touched within the last month keep their dependencies.".into(),
        guide: None,
        fix: None,
    });
    out
}

// --- dev caches -------------------------------------------------------------------

/// Only worth a line above this — below it, silence beats noise.
const CACHE_MIN_BYTES: u64 = 100 * 1024 * 1024;

/// Safe = regenerates on demand; one-click fix. (Never-touch items — ollama
/// blobs, anaconda, ~/.cache/prisma — are deliberately NOT in this table.)
const SAFE_CACHES: &[(&str, &str, &str)] = &[
    ("cache_npm", "npm cache", ".npm/_cacache"),
    ("cache_uv", "uv cache", ".cache/uv"),
    (
        "cache_huggingface",
        "Hugging Face cache",
        ".cache/huggingface",
    ),
    ("cache_puppeteer", "Puppeteer browsers", ".cache/puppeteer"),
    ("cache_gradle", "Gradle caches", ".gradle/caches"),
    (
        "cache_deriveddata",
        "Xcode DerivedData",
        "Library/Developer/Xcode/DerivedData",
    ),
];

fn cache_path(rel: &str) -> Option<PathBuf> {
    paths::home().map(|h| h.join(rel))
}

fn run_dev_caches() -> Vec<Finding> {
    let mut out = Vec::new();
    for (fix_id, label, rel) in SAFE_CACHES {
        if is_cancelled() {
            break;
        }
        let Some(path) = cache_path(rel) else {
            continue;
        };
        if !path.is_dir() {
            continue;
        }
        let bytes = du_bytes(&path);
        if bytes < CACHE_MIN_BYTES {
            continue;
        }
        out.push(Finding {
            probe_id: DEV_CACHES.id,
            scope: Scope::Disk,
            severity: Severity::Yellow,
            tag: Tag::Storage,
            summary: format!("{label} · {} reclaimable", super::vscode::fmt_mb(bytes)),
            explain: "Pure cache — the tool rebuilds it on demand. Clearing frees disk but \
                      does NOT make the machine faster, and the next run repopulates it."
                .into(),
            guide: None,
            fix: Some((*fix_id).into()),
        });
    }
    // Caution / gated items: never one-click. The app's own Terminal tab is
    // exactly where these commands belong.
    if let Some(p) = cache_path("Library/pnpm/store").filter(|p| p.is_dir()) {
        out.push(guide_finding(
            &format!("pnpm store · {}", super::vscode::fmt_mb(du_bytes(&p))),
            "pnpm hardlinks every project's packages out of this store — deleting it raw \
             breaks those projects. Prune only removes packages nothing references.",
            vec!["In this app's Terminal (or any shell): pnpm store prune".into()],
        ));
    }
    if let Some(p) = cache_path("Library/Containers/com.docker.docker").filter(|p| p.is_dir()) {
        out.push(guide_finding(
            &format!("Docker data · {}", super::vscode::fmt_mb(du_bytes(&p))),
            "Lives in ~/Library/Containers/com.docker.docker (Docker.raw is the big file). \
             Volumes may hold real data, so this is gated — never one-click.",
            vec![
                "In this app's Terminal: docker system df -v — volumes must be empty or \
                 expendable"
                    .into(),
                "Then: docker system prune -a (images/containers), or uninstall Docker \
                 Desktop entirely if unused"
                    .into(),
                "Docker Desktop → Settings → Resources → Disk can also shrink Docker.raw".into(),
            ],
        ));
    }
    if out.is_empty() {
        out.push(Finding {
            probe_id: DEV_CACHES.id,
            scope: Scope::Disk,
            severity: Severity::Green,
            tag: Tag::Storage,
            summary: "No significant dev caches".into(),
            explain: "Nothing above the 100 MB noise floor.".into(),
            guide: None,
            fix: None,
        });
    }
    out
}

fn guide_finding(name: &str, explain: &str, steps: Vec<String>) -> Finding {
    Finding {
        probe_id: DEV_CACHES.id,
        scope: Scope::Disk,
        severity: Severity::Yellow,
        tag: Tag::Storage,
        summary: format!("{name} present — manual cleanup only"),
        explain: explain.into(),
        guide: Some(steps),
        fix: None,
    }
}

// --- fixes -------------------------------------------------------------------------

/// Native-confirm copy for each destructive fix id — None means the id is
/// unknown (fix() will reject it) or needs no confirm.
pub fn fix_confirmation(fix_id: &str) -> Option<(String, String)> {
    match fix_id {
        "deep_dead_node_modules" => Some((
            "Delete dead node_modules?".into(),
            "Their projects are gone or untouched for months — they regenerate on the next \
             install."
                .into(),
        )),
        "deep_stale_node_modules" => Some((
            "Delete stale node_modules?".into(),
            "These projects were untouched for 1–6 months — an install brings the \
             dependencies back."
                .into(),
        )),
        _ => SAFE_CACHES
            .iter()
            .find(|(id, _, _)| *id == fix_id)
            .map(|(_, label, _)| {
                (
                    format!("Clear {label}?"),
                    "Pure cache — it regenerates on demand. This frees disk but does not make \
                 the machine faster."
                        .into(),
                )
            }),
    }
}

/// The ONLY entry point the generic `doctor_fix` command exposes — a strict
/// whitelist; the frontend can never name a path, only one of these ids.
pub fn fix(fix_id: &str) -> AppResult<String> {
    match fix_id {
        "deep_dead_node_modules" => delete_node_modules(Class::Dead),
        "deep_stale_node_modules" => delete_node_modules(Class::Stale),
        _ => {
            let (_, label, rel) = SAFE_CACHES
                .iter()
                .find(|(id, _, _)| *id == fix_id)
                .ok_or_else(|| AppError::InvalidName(format!("unknown fix: {fix_id}")))?;
            delete_cache(label, rel)
        }
    }
}

/// Re-scans at fix time (never trusts a stale finding), deletes only the
/// requested class, journals, reports freed bytes.
fn delete_node_modules(class: Class) -> AppResult<String> {
    let now = super::claude::now_epoch();
    let home = paths::home().ok_or_else(|| AppError::NotFound("HOME not set".into()))?;
    let downloads = home.join("Downloads");
    let (mut removed, mut freed) = (0usize, 0u64);
    for nm in find_node_modules() {
        let Some(project) = nm.parent() else { continue };
        if classify(
            project.starts_with(&downloads),
            project_age_days(project, now),
        ) != class
        {
            continue;
        }
        let bytes = du_bytes(&nm);
        if std::fs::remove_dir_all(&nm).is_ok() {
            removed += 1;
            freed += bytes;
        }
    }
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{now},"action":"deleteNodeModules","class":"{class:?}","removed":{removed},"freedBytes":{freed}}}"#
    ));
    Ok(format!(
        "Removed {removed} node_modules · freed {} — they regenerate on the next install",
        super::vscode::fmt_mb(freed)
    ))
}

fn delete_cache(label: &str, rel: &str) -> AppResult<String> {
    let path = cache_path(rel).ok_or_else(|| AppError::NotFound("HOME not set".into()))?;
    if !path.is_dir() {
        return Ok(format!("{label} is already empty."));
    }
    let bytes = du_bytes(&path);
    std::fs::remove_dir_all(&path).map_err(|e| AppError::Io(e.to_string()))?;
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"clearCache","cache":"{label}","freedBytes":{bytes}}}"#,
        super::claude::now_epoch()
    ));
    Ok(format!(
        "Cleared {label} · freed {} — it regenerates on demand",
        super::vscode::fmt_mb(bytes)
    ))
}

// --- helpers -------------------------------------------------------------------------

fn parse_du_kb(s: &str) -> Option<u64> {
    s.split_whitespace().next()?.parse().ok()
}

pub(crate) fn du_bytes(path: &Path) -> u64 {
    Command::new("du")
        .args(["-sk", &path.to_string_lossy()])
        .output()
        .ok()
        .and_then(|o| parse_du_kb(&String::from_utf8_lossy(&o.stdout)))
        .map_or(0, |kb| kb * 1024)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_by_location_and_age() {
        assert_eq!(classify(true, 0), Class::Dead, "Downloads is always dead");
        assert_eq!(classify(false, 200), Class::Dead);
        assert_eq!(classify(false, 60), Class::Stale);
        assert_eq!(classify(false, 5), Class::Active);
    }

    #[test]
    fn parses_du_output() {
        assert_eq!(parse_du_kb("487344\t/Users/x/node_modules"), Some(487_344));
        assert_eq!(parse_du_kb("garbage"), None);
    }

    #[test]
    fn fix_whitelist_rejects_unknown_ids() {
        assert!(fix("rm_-rf_slash").is_err());
        assert!(fix("cache_unknown").is_err());
    }

    // Real machine, read-only: the bounded find is fast (~0.2 s) and must only
    // return top-level node_modules dirs.
    #[test]
    fn finds_real_node_modules() {
        for nm in find_node_modules() {
            assert!(nm.ends_with("node_modules"));
            assert!(!nm
                .parent()
                .unwrap()
                .to_string_lossy()
                .contains("node_modules"));
        }
    }
}
