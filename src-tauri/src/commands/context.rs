use crate::context::AppContext;
use tauri::State;

/// Returns the machine/runtime context discovered at startup (managed State).
#[tauri::command]
pub fn get_app_context(ctx: State<'_, AppContext>) -> AppContext {
    ctx.inner().clone()
}
