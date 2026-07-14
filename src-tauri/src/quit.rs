use crate::brew::run_brew;
use crate::context::AppContext;
use crate::session::SessionServices;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// On quit: stop the services this app started ephemerally this session. Runs on a
/// detached thread joined with a hard 5s deadline so a hung `brew stop` can never
/// freeze the quit — we exit regardless once the deadline passes.
pub fn stop_session_services(app: &AppHandle) {
    let names = app.state::<SessionServices>().snapshot();
    if names.is_empty() {
        return;
    }
    let Some(brew_bin) = app.state::<AppContext>().brew_bin.clone() else {
        return;
    };

    let handle = std::thread::spawn(move || {
        for name in names {
            let _ = run_brew(&brew_bin, &["services", "stop", &name]);
        }
    });

    let deadline = Instant::now() + Duration::from_secs(5);
    while !handle.is_finished() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(50));
    }
}
