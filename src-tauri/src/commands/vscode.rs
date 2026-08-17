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

/// VACUUM every bloated state.vscdb. VSCode can't be holding them open while
/// it runs, so when it is the confirm says exactly that and force-quits it on
/// OK. The kill only ever happens behind the wording that names it — the
/// plain VACUUM confirm never closes anything.
#[tauri::command]
pub async fn vscode_vacuum(app: tauri::AppHandle) -> AppResult<String> {
    blocking(move || {
        let busy = vscode::state_dbs_in_use();
        confirm_action(
            &app,
            if busy {
                "VSCode is open — close it and VACUUM?"
            } else {
                "VACUUM VSCode databases?"
            },
            if busy {
                "VSCode is holding these databases open, so it will be closed now — unsaved \
                 changes in open editors may be lost. Then the rebuild runs; nothing is deleted."
            } else {
                "Rebuilds bloated state.vscdb files compactly, in place — nothing is deleted."
            },
            if busy {
                "Close VSCode & VACUUM"
            } else {
                "VACUUM"
            },
            busy,
        )?;
        if busy {
            vscode::force_quit_vscode()?;
        }
        vscode::vacuum_bloated()
    })
    .await
}
