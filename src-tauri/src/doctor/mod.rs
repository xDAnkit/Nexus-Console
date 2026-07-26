// Nexus Doctor — probe engine (docs/doctor/PLAN.md Phase 0).
// A probe is read-only and must never wake a daemon (the watchman lesson,
// SESSION-CONTEXT §2). Mutations only ever happen via explicit fix commands.

pub mod browser;
pub mod claude;
pub mod deepscan;
pub mod ollama;
pub mod paths;
pub mod probes;
pub mod scheduler;
pub mod system;
pub mod vscode;
pub mod windows;

use serde::{Deserialize, Serialize};

/// Scan scopes — mirror the Doctor page's scope chips 1:1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    System,
    Claude,
    Vscode,
    Browser,
    Disk,
    Startup,
}

/// Declared in report order — `as u8` is the sort key (red first).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Red,
    Yellow,
    Green,
}

/// Honest tag: disk cleanup does NOT make a machine faster. Every finding
/// carries what it actually affects; `Info` is for findings that are neither
/// (backup risk, battery wear).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Tag {
    Speed,
    Storage,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    MacOs,
    Windows,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(target_os = "windows") {
            Platform::Windows
        } else {
            Platform::MacOs
        }
    }
}

/// One line in the report: severity + one-line summary + expandable explain.
/// `guide` = manual GUI steps; `fix` = id of an automated fix command the UI
/// maps to a button (each fix is its own arg-less command — the frontend never
/// supplies paths).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub probe_id: &'static str,
    pub scope: Scope,
    pub severity: Severity,
    pub tag: Tag,
    pub summary: String,
    pub explain: String,
    pub guide: Option<Vec<String>>,
    /// Fix ids are usually static ("vscode_vacuum") but can carry a validated
    /// parameter ("ollama_rm:<model>") — the backend re-validates against the
    /// real installed set at fix time, never trusting the string itself.
    pub fix: Option<String>,
}

pub struct Probe {
    pub id: &'static str,
    pub scope: Scope,
    pub platforms: &'static [Platform],
    /// Runtime capability check — a feature the device doesn't have simply
    /// never renders (works both directions, Win↔Mac).
    pub available: fn() -> bool,
    /// Read-only. Must not wake daemons or block on anything interactive.
    pub run: fn() -> Vec<Finding>,
}

pub const REGISTRY: &[Probe] = &[
    probes::DISK_FREE,
    probes::LOAD_VS_CORES,
    system::LOW_POWER_MODE,
    system::MEMORY_TRUTH,
    system::BACKUP_RISK,
    system::STARTUP_ITEMS,
    vscode::ORPHANS,
    vscode::DB_BLOAT,
    vscode::EXTENSION_AUDIT,
    ollama::OLLAMA_MODELS,
    browser::PROCESSES,
    browser::AUDIO_BLOCKER,
    browser::STORAGE,
    browser::EXTENSIONS,
    windows::BATTERY_SAVER,
];

/// A probe that can't read its source reports that honestly instead of
/// silently vanishing from the report.
pub(crate) fn probe_failed(probe: &Probe, tag: Tag, what: &str) -> Finding {
    Finding {
        probe_id: probe.id,
        scope: probe.scope,
        severity: Severity::Yellow,
        tag,
        summary: format!("Couldn't {what}"),
        explain: "The read-only probe failed on this machine — the item was not checked."
            .to_string(),
        guide: None,
        fix: None,
    }
}

/// Probes that will actually run: platform ∩ requested scopes ∩ available.
pub fn probes_for(scopes: &[Scope]) -> Vec<&'static Probe> {
    REGISTRY
        .iter()
        .filter(|p| p.platforms.contains(&Platform::current()))
        .filter(|p| scopes.contains(&p.scope))
        .filter(|p| (p.available)())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_filters_by_scope() {
        let all = [
            Scope::System,
            Scope::Claude,
            Scope::Vscode,
            Scope::Browser,
            Scope::Disk,
            Scope::Startup,
        ];
        // vscode/ollama/browser probes are availability-gated; all exist on
        // this machine. The Windows stub is registered but filtered on macOS.
        assert_eq!(REGISTRY.len(), 15);
        assert_eq!(probes_for(&all).len(), 14);
        assert_eq!(probes_for(&[Scope::Browser]).len(), 4);
        assert_eq!(probes_for(&[Scope::Vscode]).len(), 3);
        assert_eq!(probes_for(&[Scope::Disk]).len(), 2);
        assert_eq!(probes_for(&[Scope::Disk])[0].id, "disk_free");
        assert_eq!(probes_for(&[Scope::System]).len(), 4);
        assert_eq!(probes_for(&[Scope::System])[0].id, "load_vs_cores");
        assert_eq!(probes_for(&[Scope::Startup])[0].id, "startup_items");
        assert!(probes_for(&[]).is_empty());
    }

    #[test]
    fn severity_sorts_red_first() {
        assert!((Severity::Red as u8) < (Severity::Yellow as u8));
        assert!((Severity::Yellow as u8) < (Severity::Green as u8));
    }
}
