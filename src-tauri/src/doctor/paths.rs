// The ONLY place Doctor filesystem locations live (PLAN.md). macOS-only for
// now — Windows twins land behind the same fns when that phase starts.

use std::path::PathBuf;

pub fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

pub fn claude_projects_dir() -> Option<PathBuf> {
    home().map(|h| h.join(".claude").join("projects"))
}

pub fn claude_settings_file() -> Option<PathBuf> {
    home().map(|h| h.join(".claude").join("settings.json"))
}

/// Matches the archive layout already live on this machine
/// (`~/claude-history-archive/<project>/…` + INDEX.md, see SESSION-CONTEXT §5).
pub fn archive_root() -> Option<PathBuf> {
    home().map(|h| h.join("claude-history-archive"))
}

// ponytail: stable VSCode only — Insiders/VSCodium variants when someone asks.
pub fn vscode_user_dir() -> Option<PathBuf> {
    home().map(|h| h.join("Library/Application Support/Code/User"))
}

pub fn vscode_workspace_storage() -> Option<PathBuf> {
    vscode_user_dir().map(|d| d.join("workspaceStorage"))
}

pub fn vscode_global_state_db() -> Option<PathBuf> {
    vscode_user_dir().map(|d| d.join("globalStorage").join("state.vscdb"))
}

pub fn vscode_extensions_dir() -> Option<PathBuf> {
    home().map(|h| h.join(".vscode").join("extensions"))
}
