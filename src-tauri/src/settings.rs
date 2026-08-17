//! Read-only access to the frontend's settings, for the parts of the app that
//! run without a window (the tray menu, the automation scheduler).
//!
//! The frontend owns this file — `tauri-plugin-store`'s `settings.json`, whose
//! `"settings"` object mirrors the Redux slice. Read fresh every time: it is tiny,
//! and a cache here would go stale the moment the user changes a toggle.

use tauri::Manager;

/// The `"settings"` object, or `None` when the file doesn't exist yet / isn't
/// readable / isn't JSON.
pub fn read(app: &tauri::AppHandle) -> Option<serde_json::Value> {
    let raw = app
        .path()
        .app_data_dir()
        .ok()
        .and_then(|d| std::fs::read_to_string(d.join("settings.json")).ok())?;
    serde_json::from_str::<serde_json::Value>(&raw)
        .ok()?
        .get("settings")
        .cloned()
}

/// Is this feature module switched on?
///
/// **Fail-safe direction is deliberately the opposite of the automation flags in
/// `doctor::scheduler`**: automation is opt-IN, so anything unreadable means off;
/// modules are opt-OUT, so a missing or unusable `enabledModules` means ON —
/// matching the frontend's `sanitizeModules`, which fails open rather than
/// leaving a window with no tabs.
pub fn module_enabled(settings: Option<&serde_json::Value>, id: &str) -> bool {
    let Some(list) = settings
        .and_then(|s| s.get("enabledModules"))
        .and_then(serde_json::Value::as_array)
    else {
        return true;
    };
    let known: Vec<&str> = list.iter().filter_map(serde_json::Value::as_str).collect();
    // An empty (or all-junk) list is corruption, not a choice — same as the FE.
    known.is_empty() || known.contains(&id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_key_means_every_module_is_on() {
        let s = json!({ "theme": "dark" });
        assert!(module_enabled(Some(&s), "homebrew"));
        assert!(module_enabled(None, "claude"));
    }

    #[test]
    fn a_real_choice_is_respected() {
        let s = json!({ "enabledModules": ["claude", "doctor"] });
        assert!(module_enabled(Some(&s), "claude"));
        assert!(module_enabled(Some(&s), "doctor"));
        assert!(!module_enabled(Some(&s), "homebrew"));
        assert!(!module_enabled(Some(&s), "ports"));
    }

    #[test]
    fn corruption_fails_open_never_into_a_dead_app() {
        assert!(module_enabled(
            Some(&json!({ "enabledModules": [] })),
            "homebrew"
        ));
        assert!(module_enabled(
            Some(&json!({ "enabledModules": [1, 2] })),
            "homebrew"
        ));
        assert!(module_enabled(
            Some(&json!({ "enabledModules": "homebrew" })),
            "claude"
        ));
    }
}
