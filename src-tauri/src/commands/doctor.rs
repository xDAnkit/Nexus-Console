use super::blocking;
use crate::doctor::{self, deepscan, Finding, Probe, Scope};
use crate::error::{AppError, AppResult};
use tauri::Emitter;

/// Event carrying each probe's findings as it completes — the report fills in
/// incrementally instead of one big await (PLAN.md product rule).
pub const FINDING_EVENT: &str = "doctor://finding";

/// Deep-scan progress: emitted before each probe is awaited so the frontend
/// can show "scanning X…" plus a bar. Probes run concurrently — the label
/// names the one currently being waited on (the slow tail in practice).
pub const PROGRESS_EVENT: &str = "doctor://progress";

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    probe_id: &'static str,
    index: usize,
    total: usize,
}

/// Spawn every probe first (they run concurrently on the blocking pool), then
/// await in registry order so the event stream stays deterministic.
async fn run_probes(
    app: &tauri::AppHandle,
    probes: Vec<&'static Probe>,
) -> AppResult<Vec<Finding>> {
    let handles: Vec<_> = probes
        .into_iter()
        .map(|p| (p.id, tauri::async_runtime::spawn_blocking(p.run)))
        .collect();
    let mut report = Vec::new();
    for (id, handle) in handles {
        let findings = handle
            .await
            .map_err(|e| AppError::Shell(format!("probe {id} panicked: {e}")))?;
        let _ = app.emit(FINDING_EVENT, &findings);
        report.extend(findings);
    }
    report.sort_by_key(|f| f.severity as u8);
    Ok(report)
}

/// Quick scan: every available probe in the requested scopes. Strictly read-only.
#[tauri::command]
pub async fn doctor_scan(app: tauri::AppHandle, scopes: Vec<Scope>) -> AppResult<Vec<Finding>> {
    let probes = doctor::probes_for(&scopes);
    run_probes(&app, probes).await
}

/// Deep scan = the FULL quick scan plus the slow sweep (node_modules + dev
/// caches) — "deep" means more thorough, not a different report. User-triggered
/// only. Same streaming contract.
#[tauri::command]
pub async fn doctor_deep_scan(app: tauri::AppHandle) -> AppResult<Vec<Finding>> {
    deepscan::reset_cancel();
    let mut probes = doctor::probes_for(&[
        Scope::System,
        Scope::Claude,
        Scope::Vscode,
        Scope::Browser,
        Scope::Disk,
        Scope::Startup,
    ]);
    probes.extend(deepscan::probes());
    // Same spawn-all/await-in-order contract as run_probes, plus the cancel
    // check between probes (the slow loops also poll it internally).
    let handles: Vec<_> = probes
        .into_iter()
        .map(|p| (p.id, tauri::async_runtime::spawn_blocking(p.run)))
        .collect();
    let total = handles.len();
    let mut report = Vec::new();
    for (index, (id, handle)) in handles.into_iter().enumerate() {
        let _ = app.emit(
            PROGRESS_EVENT,
            &Progress {
                probe_id: id,
                index,
                total,
            },
        );
        let findings = handle
            .await
            .map_err(|e| AppError::Shell(format!("probe {id} panicked: {e}")))?;
        if deepscan::is_cancelled() {
            return Err(AppError::Cancelled(
                "Deep scan cancelled — nothing was changed.".into(),
            ));
        }
        let _ = app.emit(FINDING_EVENT, &findings);
        report.extend(findings);
    }
    report.sort_by_key(|f| f.severity as u8);
    Ok(report)
}

/// Cancel a running deep scan — takes effect within one directory measurement.
#[tauri::command]
pub fn doctor_cancel_deep_scan() {
    deepscan::cancel();
}

/// Generic fix runner for deep-scan findings. The id is matched against a
/// strict server-side whitelist — the frontend can never name a path — and
/// every destructive fix is gated by a native confirm (Rust-side).
#[tauri::command]
pub async fn doctor_fix(app: tauri::AppHandle, fix_id: String) -> AppResult<String> {
    blocking(move || {
        // Parameterized fixes — each validates its parameter against the real
        // installed set server-side; the string itself is never trusted.
        if let Some(model) = fix_id.strip_prefix("ollama_rm:") {
            let (title, message) = crate::doctor::ollama::fix_confirmation(model);
            super::confirm_action(&app, &title, &message, "Delete", true)?;
            return crate::doctor::ollama::delete_model(model);
        }
        if let Some(label) = fix_id.strip_prefix("browser_cache:") {
            let (title, message) = crate::doctor::browser::fix_confirmation(label);
            super::confirm_action(&app, &title, &message, "Clear", true)?;
            return crate::doctor::browser::clear_cache(label);
        }
        // Non-destructive: just opens the browser's own extensions page.
        if let Some(spec) = fix_id.strip_prefix("browser_ext_manage:") {
            return crate::doctor::browser::manage_extension(spec);
        }
        if let Some(id) = fix_id.strip_prefix("vscode_ext_rm:") {
            let (title, message) = crate::doctor::vscode::fix_confirmation_ext(id);
            super::confirm_action(&app, &title, &message, "Uninstall", true)?;
            return crate::doctor::vscode::uninstall_extension(id);
        }
        if let Some((title, message)) = deepscan::fix_confirmation(&fix_id) {
            super::confirm_action(&app, &title, &message, "Delete", true)?;
        }
        deepscan::fix(&fix_id)
    })
    .await
}

/// The mutation audit trail (journal.jsonl), newest first.
#[tauri::command]
pub async fn doctor_journal() -> AppResult<Vec<crate::doctor::claude::JournalEntry>> {
    blocking(|| Ok(crate::doctor::claude::read_journal(200))).await
}

/// Write a report the frontend rendered to the Desktop and return its path.
/// The filename is composed server-side — no client-supplied paths.
#[tauri::command]
pub async fn doctor_export(content: String) -> AppResult<String> {
    blocking(move || {
        let desktop = crate::doctor::paths::home()
            .ok_or_else(|| AppError::NotFound("HOME not set".into()))?
            .join("Desktop");
        let path = desktop.join(format!(
            "nexus-doctor-report-{}.md",
            crate::doctor::claude::now_epoch()
        ));
        std::fs::write(&path, content).map_err(|e| AppError::Io(e.to_string()))?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
