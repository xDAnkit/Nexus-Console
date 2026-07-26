// Tray automation (Phase 3): while the app sits in the tray it
//   1. auto-archives old Claude chats daily (opt-in), and
//   2. VACUUMs bloated state.vscdb files whenever VSCode is closed (opt-in) —
//      the deferred-VACUUM idea: being OUTSIDE VSCode is exactly why this app
//      can do what the in-editor assistant could not.
// A plain daemon thread with a coarse tick — nothing here needs precision.
// Settings are re-read from disk every tick, so toggles apply without restart.
// The Scheduler only orchestrates; all mutation logic (and journaling) lives
// in claude.rs / vscode.rs (Scanner ≠ Fixer ≠ Scheduler).

use super::{claude, vscode};
use std::time::{Duration, Instant};
use tauri::Manager;

const TICK: Duration = Duration::from_secs(5 * 60);
const DAILY: Duration = Duration::from_secs(24 * 60 * 60);
const DEFAULT_CUTOFF_DAYS: u32 = 30;

#[derive(Debug, PartialEq, Eq)]
pub struct Automation {
    pub archive: bool,
    pub cutoff_days: u32,
    pub vacuum: bool,
}

/// The `"settings"` object inside the frontend's plugin-store file.
/// Fail-safe: anything missing/unrecognized → feature stays OFF.
fn parse_settings(v: Option<&serde_json::Value>) -> Automation {
    let get_bool = |k: &str| {
        v.and_then(|s| s.get(k))
            .and_then(serde_json::Value::as_bool)
            == Some(true)
    };
    Automation {
        archive: get_bool("autoArchiveEnabled"),
        cutoff_days: v
            .and_then(|s| s.get("autoArchiveCutoffDays"))
            .and_then(serde_json::Value::as_u64)
            .map_or(DEFAULT_CUTOFF_DAYS, |d| d.clamp(1, 3650) as u32),
        vacuum: get_bool("autoVacuumEnabled"),
    }
}

/// Fresh read from disk every tick — no cache to go stale when the frontend
/// saves a toggle.
fn read_settings(app: &tauri::AppHandle) -> Automation {
    let raw = app
        .path()
        .app_data_dir()
        .ok()
        .and_then(|d| std::fs::read_to_string(d.join("settings.json")).ok())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    parse_settings(raw.as_ref().and_then(|r| r.get("settings")))
}

pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut last_archive: Option<Instant> = None;
        loop {
            let auto = read_settings(&app);

            if auto.archive && last_archive.is_none_or(|t| t.elapsed() >= DAILY) {
                if let Some(msg) = auto_archive_all(auto.cutoff_days) {
                    notify(&app, &msg);
                }
                last_archive = Some(Instant::now());
            }

            // Bloat check is a few PRAGMA reads — cheap enough to poll; the
            // fix itself only fires when VSCode is closed AND something is
            // actually bloated.
            if auto.vacuum && !vscode::vscode_running() {
                if let Ok(msg) = vscode::vacuum_bloated() {
                    if msg.starts_with("Freed") {
                        notify(&app, &msg);
                    }
                }
            }

            std::thread::sleep(TICK);
        }
    });
}

/// Archive-by-age across every project; per-project failures are skipped.
/// None when nothing moved (no notification noise).
fn auto_archive_all(cutoff_days: u32) -> Option<String> {
    let projects = claude::list_projects().ok()?;
    let (mut moved, mut touched) = (0u32, 0u32);
    for p in &projects {
        // Dry-run first so untouched projects get no INDEX/journal churn.
        let Ok(preview) = claude::archive(&p.dir_name, cutoff_days, false) else {
            continue;
        };
        if preview.candidates.is_empty() {
            continue;
        }
        if let Ok(res) = claude::archive(&p.dir_name, cutoff_days, true) {
            if res.moved > 0 {
                moved += res.moved;
                touched += 1;
            }
        }
    }
    (moved > 0).then(|| {
        format!(
            "Archived {moved} old chat{} across {touched} project{}",
            if moved == 1 { "" } else { "s" },
            if touched == 1 { "" } else { "s" }
        )
    })
}

fn notify(app: &tauri::AppHandle, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    let _ = app
        .notification()
        .builder()
        .title("Nexus Doctor")
        .body(body)
        .show();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_default_to_off() {
        let a = parse_settings(None);
        assert_eq!(
            a,
            Automation {
                archive: false,
                cutoff_days: DEFAULT_CUTOFF_DAYS,
                vacuum: false
            }
        );
        // unrecognized shapes stay off (fail-safe)
        let junk: serde_json::Value = serde_json::json!({"autoArchiveEnabled": "yes"});
        assert!(!parse_settings(Some(&junk)).archive);
    }

    #[test]
    fn settings_parse_and_clamp() {
        let v = serde_json::json!({
            "autoArchiveEnabled": true,
            "autoArchiveCutoffDays": 999999,
            "autoVacuumEnabled": true,
            "theme": "dark"
        });
        let a = parse_settings(Some(&v));
        assert!(a.archive && a.vacuum);
        assert_eq!(a.cutoff_days, 3650);
    }
}
