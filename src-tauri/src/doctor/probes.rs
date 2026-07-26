// Phase 0 seed probes — prove the scan loop end-to-end with two sub-ms,
// syscall-only reads (no shell-outs, nothing woken). Phase 1+ probes get their
// own domain files (system.rs, claude.rs, …).

use super::{probe_failed, Finding, Platform, Probe, Scope, Severity, Tag};

const UNIX: &[Platform] = &[Platform::MacOs];

fn always() -> bool {
    true
}

pub const DISK_FREE: Probe = Probe {
    id: "disk_free",
    scope: Scope::Disk,
    platforms: UNIX,
    available: always,
    run: run_disk_free,
};

pub const LOAD_VS_CORES: Probe = Probe {
    id: "load_vs_cores",
    scope: Scope::System,
    platforms: UNIX,
    available: always,
    run: run_load_vs_cores,
};

// --- disk_free -------------------------------------------------------------

const DISK_RED_GB: f64 = 10.0;
const DISK_YELLOW_GB: f64 = 30.0;
const GB: f64 = 1e9; // decimal GB, matching what Finder shows

fn classify_disk(free_bytes: u64) -> Severity {
    let gb = free_bytes as f64 / GB;
    if gb < DISK_RED_GB {
        Severity::Red
    } else if gb < DISK_YELLOW_GB {
        Severity::Yellow
    } else {
        Severity::Green
    }
}

fn run_disk_free() -> Vec<Finding> {
    let Some(free) = disk_free_bytes() else {
        return vec![probe_failed(
            &DISK_FREE,
            Tag::Storage,
            "read free disk space",
        )];
    };
    let severity = classify_disk(free);
    let gb = free as f64 / GB;
    let explain = match severity {
        Severity::Green => "Plenty of headroom.".to_string(),
        _ => format!(
            "Below ~{DISK_YELLOW_GB:.0} GB free, macOS starts struggling — swap, caches and \
             updates all need headroom. Deep scan (dev caches, node_modules) is where the \
             reclaimable space usually hides."
        ),
    };
    vec![Finding {
        probe_id: DISK_FREE.id,
        scope: DISK_FREE.scope,
        severity,
        tag: Tag::Storage,
        summary: format!("{gb:.0} GB free on /"),
        explain,
        guide: None,
        fix: None,
    }]
}

fn disk_free_bytes() -> Option<u64> {
    let path = std::ffi::CString::new("/").ok()?;
    let mut vfs: libc::statvfs = unsafe { std::mem::zeroed() };
    // SAFETY: valid NUL-terminated path + zeroed out-param, per statvfs(3).
    if unsafe { libc::statvfs(path.as_ptr(), &mut vfs) } != 0 {
        return None;
    }
    Some(vfs.f_bavail as u64 * vfs.f_frsize as u64)
}

// --- load_vs_cores ----------------------------------------------------------

fn classify_load(load5: f64, cores: usize) -> Severity {
    let cores = cores as f64;
    if load5 >= cores * 2.0 {
        Severity::Red
    } else if load5 >= cores {
        Severity::Yellow
    } else {
        Severity::Green
    }
}

fn run_load_vs_cores() -> Vec<Finding> {
    let Some(load5) = load_avg_5min() else {
        return vec![probe_failed(
            &LOAD_VS_CORES,
            Tag::Speed,
            "read the load average",
        )];
    };
    let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
    let severity = classify_load(load5, cores);
    let explain = match severity {
        Severity::Green => "The CPU is keeping up — no processes are queueing.".to_string(),
        _ => format!(
            "5-minute load {load5:.1} on {cores} cores: sustained load above the core count \
             means processes are queueing for CPU. Open Activity Monitor → CPU to find the \
             top consumer (a boot-time Spotlight re-index is transient and settles on its own)."
        ),
    };
    vec![Finding {
        probe_id: LOAD_VS_CORES.id,
        scope: LOAD_VS_CORES.scope,
        severity,
        tag: Tag::Speed,
        summary: format!("Load {load5:.1} over 5 min on {cores} cores"),
        explain,
        guide: None,
        fix: None,
    }]
}

/// 5-minute average — the "sustained" signal; 1-minute spikes are noise.
fn load_avg_5min() -> Option<f64> {
    let mut loads = [0f64; 3];
    // SAFETY: fixed-size out array, per getloadavg(3).
    if unsafe { libc::getloadavg(loads.as_mut_ptr(), 3) } == 3 {
        Some(loads[1])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_thresholds() {
        assert_eq!(classify_disk(5_000_000_000), Severity::Red);
        assert_eq!(classify_disk(15_000_000_000), Severity::Yellow);
        assert_eq!(classify_disk(100_000_000_000), Severity::Green);
    }

    #[test]
    fn load_thresholds() {
        assert_eq!(classify_load(2.0, 8), Severity::Green);
        assert_eq!(classify_load(9.5, 8), Severity::Yellow);
        assert_eq!(classify_load(16.0, 8), Severity::Red);
    }

    // Real syscalls against this machine — both must produce exactly one finding.
    #[test]
    fn probes_run_on_real_machine() {
        assert_eq!(run_disk_free().len(), 1);
        assert_eq!(run_load_vs_cores().len(), 1);
    }
}
