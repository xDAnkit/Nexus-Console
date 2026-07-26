// VSCode Doctor fix commands. Arg-less on purpose — each re-scans at fix time
// and never trusts (or accepts) a path from the frontend. Every action shows
// a native macOS confirm first (Rust-side, unbypassable).

use super::{blocking, confirm_action};
use crate::doctor::vscode;
use crate::error::AppResult;

/// Delete workspaceStorage caches whose project folder no longer exists.
#[tauri::command]
pub async fn vscode_cleanup_orphans(app: tauri::AppHandle) -> AppResult<String> {
    blocking(move || {
        confirm_action(
            &app,
            "Delete orphan VSCode caches?",
            "These caches belong to project folders that no longer exist — nothing can use \
             them again.",
            "Delete",
            true,
        )?;
        vscode::cleanup_orphans()
    })
    .await
}

/// VACUUM every bloated state.vscdb. Refuses while VSCode is running.
#[tauri::command]
pub async fn vscode_vacuum(app: tauri::AppHandle) -> AppResult<String> {
    blocking(move || {
        confirm_action(
            &app,
            "VACUUM VSCode databases?",
            "Rebuilds bloated state.vscdb files compactly, in place — nothing is deleted. \
             VSCode must be closed while it runs.",
            "VACUUM",
            false,
        )?;
        vscode::vacuum_bloated()
    })
    .await
}
