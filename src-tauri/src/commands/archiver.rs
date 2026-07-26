// Claude Archiver commands — thin async wrappers; all fs work off-thread.
// EVERY mutation shows a native macOS confirm first (Rust-side, unbypassable)
// and is journaled inside doctor::claude.

use super::{blocking, confirm_action};
use crate::doctor::claude::{
    self, ArchiveResult, ArchivedChat, ArchivedProject, BulkResult, ClaudeProject, ClaudeSettings,
};
use crate::error::AppResult;

fn chats(n: usize) -> String {
    format!("chat{}", if n == 1 { "" } else { "s" })
}

/// Whether Claude Code exists on this machine (~/.claude/projects present) —
/// the Claude Chats sidebar module hides entirely when it doesn't.
#[tauri::command]
pub fn claude_installed() -> bool {
    crate::doctor::paths::claude_projects_dir().is_some_and(|p| p.is_dir())
}

#[tauri::command]
pub async fn claude_projects() -> AppResult<Vec<ClaudeProject>> {
    blocking(claude::list_projects).await
}

#[tauri::command]
pub async fn claude_sessions(dir_name: String) -> AppResult<Vec<ArchivedChat>> {
    blocking(move || claude::sessions(&dir_name)).await
}

/// Cutoff-based archive. `apply: false` is the silent dry-run; `apply: true`
/// previews server-side so the native confirm can state the real count.
#[tauri::command]
pub async fn claude_archive(
    app: tauri::AppHandle,
    dir_name: String,
    cutoff_days: u32,
    apply: bool,
) -> AppResult<ArchiveResult> {
    blocking(move || {
        if apply {
            let n = claude::archive(&dir_name, cutoff_days, false)?
                .candidates
                .len();
            if n > 0 {
                confirm_action(
                    &app,
                    &format!("Archive {n} {} older than {cutoff_days} days?", chats(n)),
                    "They move to ~/claude-history-archive — nothing is deleted, and any chat \
                     can be restored later.",
                    "Archive",
                    false,
                )?;
            }
        }
        claude::archive(&dir_name, cutoff_days, apply)
    })
    .await
}

/// Archive an explicit selection.
#[tauri::command]
pub async fn claude_archive_files(
    app: tauri::AppHandle,
    dir_name: String,
    files: Vec<String>,
) -> AppResult<BulkResult> {
    blocking(move || {
        confirm_action(
            &app,
            &format!("Archive {} selected {}?", files.len(), chats(files.len())),
            "They move to ~/claude-history-archive — nothing is deleted, and any chat can \
             be restored later.",
            "Archive",
            false,
        )?;
        claude::archive_files(&dir_name, &files)
    })
    .await
}

#[tauri::command]
pub async fn claude_archived() -> AppResult<Vec<ArchivedProject>> {
    blocking(claude::archived).await
}

#[tauri::command]
pub async fn claude_restore(
    app: tauri::AppHandle,
    dir_name: String,
    files: Vec<String>,
) -> AppResult<BulkResult> {
    blocking(move || {
        confirm_action(
            &app,
            &format!("Restore {} {}?", files.len(), chats(files.len())),
            "They move back into the project — restart VSCode to see them again.",
            "Restore",
            false,
        )?;
        claude::restore(&dir_name, &files)
    })
    .await
}

/// Permanent delete from the archive — a destructive archiver action.
#[tauri::command]
pub async fn claude_delete(
    app: tauri::AppHandle,
    folder: String,
    files: Vec<String>,
) -> AppResult<BulkResult> {
    blocking(move || {
        confirm_action(
            &app,
            &format!("Delete {} archived {}?", files.len(), chats(files.len())),
            "Permanent — these transcripts cannot be recovered afterwards.",
            "Delete",
            true,
        )?;
        claude::delete(&folder, &files)
    })
    .await
}

/// Permanent delete of LIVE chats — skips the archive, removes the transcripts
/// straight from ~/.claude/projects. Destructive, so it gets the same native
/// confirm as archive delete.
#[tauri::command]
pub async fn claude_delete_live(
    app: tauri::AppHandle,
    dir_name: String,
    files: Vec<String>,
) -> AppResult<BulkResult> {
    blocking(move || {
        confirm_action(
            &app,
            &format!("Delete {} {}?", files.len(), chats(files.len())),
            "Permanent — these transcripts are removed without archiving and cannot be \
             recovered. To keep them, archive instead.",
            "Delete",
            true,
        )?;
        claude::delete_live(&dir_name, &files)
    })
    .await
}

#[tauri::command]
pub async fn claude_settings() -> AppResult<ClaudeSettings> {
    blocking(claude::settings).await
}

#[tauri::command]
pub async fn claude_set_retention(app: tauri::AppHandle, days: u32) -> AppResult<()> {
    blocking(move || {
        confirm_action(
            &app,
            &format!("Keep Claude chats for {days} days?"),
            "Claude Code silently deletes transcripts older than this. A backup of \
             settings.json is written before the change.",
            "Save",
            false,
        )?;
        claude::set_retention(days)
    })
    .await
}
