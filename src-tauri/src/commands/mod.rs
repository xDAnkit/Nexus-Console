pub mod archiver;
pub mod context;
pub mod doctor;
pub mod packages;
pub mod ports;
pub mod services;
pub mod vscode;

use crate::error::{AppError, AppResult};

/// Run blocking fs/db work off the main thread — shared by all doctor commands.
pub(crate) async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Io(format!("task failed: {e}")))?
}

/// Native macOS confirm (NSAlert) — EVERY user-data mutation goes through one
/// of these, with a proper message. Living in Rust means the frontend can
/// never bypass it. `destructive: true` renders the warning style. Call from
/// a blocking context only — `blocking_show` parks the thread until answered.
pub(crate) fn confirm_action(
    app: &tauri::AppHandle,
    title: &str,
    message: &str,
    action: &str,
    destructive: bool,
) -> AppResult<()> {
    use tauri::Manager;
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    let mut dialog = app
        .dialog()
        .message(message)
        .title(title)
        .kind(if destructive {
            MessageDialogKind::Warning
        } else {
            MessageDialogKind::Info
        })
        .buttons(MessageDialogButtons::OkCancelCustom(
            action.into(),
            "Cancel".into(),
        ));
    // Parent to the main window → a window-modal SHEET: native macOS, but bound
    // to the Nexus window so it never floats over another app / Space.
    if let Some(win) = app.get_webview_window("main") {
        dialog = dialog.parent(&win);
    }
    if dialog.blocking_show() {
        Ok(())
    } else {
        Err(AppError::Cancelled("Cancelled — nothing changed.".into()))
    }
}

/// FE-invokable native confirm for bulk service actions (Stop / Stop all).
/// Returns `true` if confirmed, `false` if cancelled — the frontend gates the
/// bulk mutation on it. Off the async runtime via `blocking` (sheet parks it).
#[tauri::command]
pub async fn confirm_bulk(
    app: tauri::AppHandle,
    title: String,
    message: String,
    action: String,
    destructive: bool,
) -> bool {
    blocking(move || Ok(confirm_action(&app, &title, &message, &action, destructive).is_ok()))
        .await
        .unwrap_or(false)
}
