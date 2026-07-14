use crate::error::{AppError, AppResult};
use crate::util::{lsof, ps};
use std::collections::HashSet;
use std::process::Command;

/// One listening port + its owning process, enriched with cpu/mem.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortDto {
    pub pid: u32,
    pub command: String,
    pub user: String,
    pub port: u16,
    pub proto: String,
    pub cpu: Option<f64>,
    pub memory_bytes: Option<u64>,
}

/// `async` + `spawn_blocking` so the lsof/ps shell-outs run OFF the main thread —
/// a plain sync command would block the UI thread on every poll (jank on tab switch).
#[tauri::command]
pub async fn list_ports(listening_only: bool) -> AppResult<Vec<PortDto>> {
    tauri::async_runtime::spawn_blocking(move || collect_ports(listening_only))
        .await
        .map_err(|e| AppError::Shell(format!("lsof task failed: {e}")))?
}

/// Testable core (blocking). Never call directly from a sync command — it shells out.
fn collect_ports(listening_only: bool) -> AppResult<Vec<PortDto>> {
    let mut rows = lsof::parse_lsof_fields(&run_lsof(listening_only));

    // Merge IPv4/IPv6 duplicates of the same (pid, port).
    let mut seen = HashSet::new();
    rows.retain(|r| seen.insert((r.pid, r.port)));

    let ids: Vec<String> = {
        let mut pids: Vec<u32> = rows.iter().map(|r| r.pid).collect();
        pids.sort_unstable();
        pids.dedup();
        pids.iter().map(u32::to_string).collect()
    };
    let samples = if ids.is_empty() {
        Default::default()
    } else {
        ps::parse_ps(&run_ps(&ids))
    };

    Ok(rows
        .into_iter()
        .map(|r| {
            let s = samples.get(&r.pid);
            PortDto {
                cpu: s.map(|s| s.cpu),
                memory_bytes: s.map(|s| s.rss_bytes),
                pid: r.pid,
                command: r.command,
                user: r.user,
                port: r.port,
                proto: r.proto,
            }
        })
        .collect())
}

/// SIGTERM (or SIGKILL when `force`). `sudo` escalates via the native admin prompt.
/// Guards: never signal pid < 2 (kernel/launchd) or Nexus itself.
// async so the sudo path's `osascript … with administrator privileges` (a
// blocking macOS auth dialog) doesn't stall the main-thread event loop.
#[tauri::command]
pub async fn kill_process(pid: u32, force: bool, sudo: bool) -> AppResult<()> {
    if pid < 2 {
        return Err(AppError::Forbidden("refusing to signal pid < 2".into()));
    }
    if pid == std::process::id() {
        return Err(AppError::Forbidden("refusing to kill Nexus Console".into()));
    }
    let sig_name = if force { "KILL" } else { "TERM" };

    if sudo {
        // Whitelisted admin command — only a fixed signal name + a validated u32 pid
        // are interpolated, so there's no injection surface. Review as security code.
        let script = format!(
            "do shell script \"/bin/kill -{sig_name} {pid}\" with administrator privileges"
        );
        let out = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AppError::Shell(format!("osascript: {e}")))?;
        if out.status.success() {
            Ok(())
        } else {
            Err(AppError::Shell(
                String::from_utf8_lossy(&out.stderr).trim().to_string(),
            ))
        }
    } else {
        let sig = if force { libc::SIGKILL } else { libc::SIGTERM };
        // SAFETY: kill(2) with a validated pid + constant signal.
        if unsafe { libc::kill(pid as i32, sig) } == 0 {
            Ok(())
        } else {
            let err = std::io::Error::last_os_error();
            if err.raw_os_error() == Some(libc::EPERM) {
                Err(AppError::Forbidden(
                    "permission denied (needs admin)".into(),
                ))
            } else {
                Err(AppError::Io(format!("kill failed: {err}")))
            }
        }
    }
}

fn run_lsof(listening_only: bool) -> String {
    let mut args = vec!["-nP", "-iTCP", "-FpcLtn"];
    if listening_only {
        args.push("-sTCP:LISTEN");
    }
    Command::new("lsof")
        .args(&args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

fn run_ps(ids: &[String]) -> String {
    Command::new("ps")
        .args(["-o", "pid=,%cpu=,rss=,etime=", "-p", &ids.join(",")])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Full lsof + ps + dedup against the real machine. Ignored in CI.
    #[test]
    #[ignore]
    fn lists_real_ports() {
        let ports = collect_ports(true).unwrap();
        println!("{} listeners", ports.len());
        assert!(
            ports.iter().any(|p| p.port == 6379),
            "expected redis on :6379"
        );
        // dedup guarantees one row per (pid, port)
        let mut seen = HashSet::new();
        assert!(ports.iter().all(|p| seen.insert((p.pid, p.port))));
    }
}
