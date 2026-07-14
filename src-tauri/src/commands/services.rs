use crate::brew::{run_brew, BrewLock};
use crate::context::AppContext;
use crate::error::{AppError, AppResult};
use crate::util::{launchctl, lsof, ps, validate};
use std::process::Command;
use tauri::State;

#[derive(serde::Deserialize)]
struct BrewEntry {
    name: String,
    status: String,
    file: Option<String>,
}

/// Flat, Option-typed view of one brew service. Mirrored by the zod schema in JS.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDto {
    pub name: String,
    pub status: String,
    pub pid: Option<u32>,
    pub cpu: Option<f64>,
    pub memory_bytes: Option<u64>,
    pub uptime_secs: Option<u64>,
    pub port: Option<u16>,
    pub healthy: Option<bool>,
    pub plist: Option<String>,
}

/// Status + pid always; cpu/mem/health only when `with_stats` (skipped off the
/// Services tab so the sidebar badge stays cheap).
/// `async` + `spawn_blocking` so brew/launchctl/ps/lsof run OFF the main thread —
/// a plain sync command would freeze the UI on every 4s poll (jank on tab switch).
#[tauri::command]
pub async fn list_services(
    ctx: State<'_, AppContext>,
    with_stats: bool,
) -> AppResult<Vec<ServiceDto>> {
    let brew_bin = ctx
        .brew_bin
        .as_ref()
        .ok_or_else(|| AppError::NotFound("Homebrew not found".into()))?
        .clone();
    tauri::async_runtime::spawn_blocking(move || collect_services(&brew_bin, with_stats))
        .await
        .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

/// Testable core (no Tauri State) — see `discovers_local_services`.
fn collect_services(brew_bin: &str, with_stats: bool) -> AppResult<Vec<ServiceDto>> {
    let out = Command::new(brew_bin)
        .args(["services", "list", "--json"])
        .output()
        .map_err(|e| AppError::Shell(format!("brew services list failed: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Shell(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    let entries: Vec<BrewEntry> = serde_json::from_slice(&out.stdout)
        .map_err(|e| AppError::Parse(format!("brew services json: {e}")))?;

    let pids = launchctl::parse_launchctl(&run_launchctl());
    let (samples, listen_ports) = if with_stats && !pids.is_empty() {
        let ids: Vec<String> = pids.values().map(u32::to_string).collect();
        (
            ps::parse_ps(&run_ps(&ids)),
            lsof::parse_listening_ports(&run_lsof(&ids)),
        )
    } else {
        Default::default()
    };

    let services = entries
        .into_iter()
        .map(|e| {
            let pid = pids.get(&e.name).copied();
            let sample = pid.and_then(|p| samples.get(&p));
            // Real listening port from lsof; its presence is the health signal.
            let port = pid.and_then(|p| listen_ports.get(&p).copied());
            let healthy = if with_stats && e.status == "started" {
                Some(port.is_some())
            } else {
                None
            };
            ServiceDto {
                pid,
                cpu: sample.map(|s| s.cpu),
                memory_bytes: sample.map(|s| s.rss_bytes),
                uptime_secs: sample.map(|s| s.uptime_secs),
                port,
                healthy,
                plist: e.file,
                name: e.name,
                status: e.status,
            }
        })
        .collect();
    Ok(services)
}

fn run_launchctl() -> String {
    Command::new("launchctl")
        .arg("list")
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

fn run_lsof(ids: &[String]) -> String {
    Command::new("lsof")
        .args(["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", &ids.join(",")])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

// ---- Write path (P3) -------------------------------------------------------

use crate::session::SessionServices;

fn brew_bin<'a>(ctx: &'a State<'_, AppContext>) -> AppResult<&'a str> {
    ctx.brew_bin
        .as_deref()
        .ok_or_else(|| AppError::NotFound("Homebrew not found".into()))
}

/// Track whether this service is app-started-ephemeral (stopped on quit) or not.
fn record_intent(session: &SessionServices, name: &str, linked: bool) {
    if linked {
        session.unmark(name); // registered → persists → never our quit-stop
    } else {
        session.mark_ephemeral(name);
    }
}

/// linked → `brew services start` (launchd-registered, persists); unlinked →
/// `brew services run` (ephemeral).
// async so Tauri runs it off the main thread — a sync command runs on the main
// thread, and the blocking `brew services …` subprocess would freeze the whole
// UI (the WebView can't paint the loader) until it returns. Same pattern as
// `list_services` above.
#[tauri::command]
pub async fn start_service(
    name: String,
    linked: bool,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
    session: State<'_, SessionServices>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    let action = if linked { "start" } else { "run" };
    run_brew(brew_bin(&ctx)?, &["services", action, &name])?;
    record_intent(&session, &name, linked);
    Ok(())
}

#[tauri::command]
pub async fn stop_service(
    name: String,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
    session: State<'_, SessionServices>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    run_brew(brew_bin(&ctx)?, &["services", "stop", &name])?;
    session.unmark(&name); // no longer running — nothing to quit-stop
    Ok(())
}

#[tauri::command]
pub async fn restart_service(
    name: String,
    linked: bool,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
    session: State<'_, SessionServices>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    let bin = brew_bin(&ctx)?;
    run_brew(bin, &["services", "stop", &name])?;
    let action = if linked { "start" } else { "run" };
    run_brew(bin, &["services", action, &name])?;
    record_intent(&session, &name, linked);
    Ok(())
}

/// Migrate a RUNNING service between start (registered) and run (ephemeral).
#[tauri::command]
pub async fn set_link_intent(
    name: String,
    linked: bool,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
    session: State<'_, SessionServices>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    let bin = brew_bin(&ctx)?;
    run_brew(bin, &["services", "stop", &name])?;
    let action = if linked { "start" } else { "run" };
    run_brew(bin, &["services", action, &name])?;
    record_intent(&session, &name, linked);
    Ok(())
}

#[tauri::command]
pub async fn install_formula(
    name: String,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    run_brew(brew_bin(&ctx)?, &["install", &name])?;
    Ok(())
}

/// `brew search <query>` → formula/cask names (headers stripped).
#[tauri::command]
pub async fn search_formulae(query: String, ctx: State<'_, AppContext>) -> AppResult<Vec<String>> {
    if query.is_empty() || query.len() > 64 {
        return Err(AppError::InvalidName("invalid search query".into()));
    }
    // `brew search` is a slow (cold: multi-second) subprocess. Run it off the
    // main thread so a sync command can't freeze the UI while it runs.
    let brew = brew_bin(&ctx)?.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_brew(&brew, &["search", &query])?;
        Ok(out
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with("==>"))
            .map(String::from)
            .collect::<Vec<String>>())
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

/// Available versions of a formula: the base + its `@version` variants
/// (e.g. redis → [redis, redis@8.2, redis@6.2]).
#[tauri::command]
pub async fn formula_versions(name: String, ctx: State<'_, AppContext>) -> AppResult<Vec<String>> {
    validate::validate_formula(&name)?;
    // `brew search` is a slow (cold: multi-second) subprocess. Run it off the
    // main thread so opening the ⋯ menu never freezes the UI (the first-open lag).
    let brew = brew_bin(&ctx)?.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let base = name.split('@').next().unwrap_or(&name).to_string();
        let prefix = format!("{base}@");
        let out = run_brew(&brew, &["search", &base])?;
        let mut versions: Vec<String> = out
            .lines()
            .map(str::trim)
            .filter(|l| *l == base || l.starts_with(&prefix))
            .map(String::from)
            .collect();
        // Base first, then variants; stable otherwise.
        versions.sort_by_key(|v| (v != &base, v.clone()));
        versions.dedup();
        Ok(versions)
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

#[tauri::command]
pub async fn uninstall_formula(
    name: String,
    ignore_dependents: bool,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    let mut args = vec!["uninstall"];
    if ignore_dependents {
        args.push("--ignore-dependencies");
    }
    args.push(&name);
    run_brew(brew_bin(&ctx)?, &args)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_brew_services_json() {
        let json = include_str!("../../../fixtures/brew-services-list.json");
        let entries: Vec<BrewEntry> = serde_json::from_str(json).unwrap();
        let redis = entries.iter().find(|e| e.name == "redis").unwrap();
        assert_eq!(redis.status, "started");
        assert!(redis.file.is_some());
    }

    // Full orchestration against real brew on this Mac. Ignored in CI.
    // Run with: cargo test -- --ignored
    #[test]
    #[ignore]
    fn discovers_local_services() {
        let services = collect_services("/opt/homebrew/bin/brew", true).unwrap();
        let redis = services
            .iter()
            .find(|s| s.name == "redis")
            .expect("redis in brew services");
        println!("redis: {redis:?}");
        if redis.status == "started" {
            assert!(redis.cpu.is_some(), "running service has cpu sample");
            assert_eq!(redis.port, Some(6379));
        }
    }
}
