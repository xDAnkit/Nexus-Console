use crate::context::{AppContext, BrewVersion};
use tauri::State;

/// Returns the machine/runtime context discovered at startup (managed State).
/// brewVersion is resolved async post-startup — null until it lands.
#[tauri::command]
pub fn get_app_context(ctx: State<'_, AppContext>, version: State<'_, BrewVersion>) -> AppContext {
    let mut out = ctx.inner().clone();
    out.brew_version = version.0.read().unwrap().clone();
    out
}
