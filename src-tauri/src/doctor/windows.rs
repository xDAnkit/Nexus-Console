// Phase 6 — Windows stubs: a real Windows-only registry entry that PROVES the
// platform filter works in both directions (it must never surface on macOS).
// No feature work — real Windows probes (powercfg, Task Scheduler, Windows
// Search) replace these bodies when a Windows build actually exists.

use super::{Finding, Platform, Probe, Scope};

fn always() -> bool {
    true
}

fn stub() -> Vec<Finding> {
    vec![] // intentionally empty until real Windows probes land
}

pub const BATTERY_SAVER: Probe = Probe {
    id: "battery_saver",
    scope: Scope::System,
    platforms: &[Platform::Windows],
    available: always,
    run: stub,
};
