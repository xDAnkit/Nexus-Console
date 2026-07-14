use std::collections::HashSet;
use std::sync::Mutex;

/// Services THIS app started ephemerally (`brew services run`) this session — the
/// only ones stopped on quit. Runtime-only (never persisted), so we can't kill a
/// service started outside the app or in a previous session.
#[derive(Default)]
pub struct SessionServices(pub Mutex<HashSet<String>>);

impl SessionServices {
    pub fn mark_ephemeral(&self, name: &str) {
        if let Ok(mut s) = self.0.lock() {
            s.insert(name.to_string());
        }
    }
    pub fn unmark(&self, name: &str) {
        if let Ok(mut s) = self.0.lock() {
            s.remove(name);
        }
    }
    pub fn snapshot(&self) -> Vec<String> {
        self.0
            .lock()
            .map(|s| s.iter().cloned().collect())
            .unwrap_or_default()
    }
}
