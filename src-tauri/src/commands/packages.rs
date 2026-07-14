use crate::brew::{run_brew, BrewLock};
use crate::context::AppContext;
use crate::error::{AppError, AppResult};
use crate::util::validate;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageDto {
    pub name: String,
    pub version: String,
    pub kind: String, // "formula" | "cask"
    pub outdated: bool,
    pub latest_version: Option<String>,
    pub pinned: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub name: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub version: Option<String>,
    pub dependencies: Vec<String>,
    pub is_service: bool,
    pub is_cask: bool,
}

fn brew_bin<'a>(ctx: &'a State<'_, AppContext>) -> AppResult<&'a str> {
    ctx.brew_bin
        .as_deref()
        .ok_or_else(|| AppError::NotFound("Homebrew not found".into()))
}

/// `name version[ version2 …]` → (name, joined versions).
fn parse_installed_line(line: &str) -> Option<(String, String)> {
    let mut it = line.split_whitespace();
    let name = it.next()?.to_string();
    let version = it.collect::<Vec<_>>().join(", ");
    Some((name, version))
}

/// name → (latest_version, pinned) from `brew outdated --json=v2`.
fn parse_outdated(json: &str) -> HashMap<String, (Option<String>, bool)> {
    #[derive(serde::Deserialize)]
    struct Entry {
        name: String,
        current_version: Option<String>,
        #[serde(default)]
        pinned: bool,
    }
    #[derive(serde::Deserialize, Default)]
    struct Outdated {
        #[serde(default)]
        formulae: Vec<Entry>,
        #[serde(default)]
        casks: Vec<Entry>,
    }
    let parsed: Outdated = serde_json::from_str(json).unwrap_or_default();
    parsed
        .formulae
        .into_iter()
        .chain(parsed.casks)
        .map(|e| (e.name, (e.current_version, e.pinned)))
        .collect()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutdatedDto {
    pub name: String,
    pub latest_version: Option<String>,
    pub pinned: bool,
}

/// The installed list only (`brew list` — fast). Outdated status is fetched
/// separately by `packages_outdated` so the table can render immediately
/// instead of waiting on the slow `brew outdated`. Runs off the main thread.
#[tauri::command]
pub async fn list_packages(ctx: State<'_, AppContext>) -> AppResult<Vec<PackageDto>> {
    let brew = brew_bin(&ctx)?.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let formulae = run_brew(&brew, &["list", "--formula", "--versions"]).unwrap_or_default();
        let casks = run_brew(&brew, &["list", "--cask", "--versions"]).unwrap_or_default();

        let mut out = Vec::new();
        for (text, kind) in [(&formulae, "formula"), (&casks, "cask")] {
            for line in text.lines() {
                let Some((name, version)) = parse_installed_line(line) else {
                    continue;
                };
                out.push(PackageDto {
                    name,
                    version,
                    kind: kind.to_string(),
                    outdated: false,
                    latest_version: None,
                    pinned: false,
                });
            }
        }
        out.sort_by(|a, b| a.name.cmp(&b.name));
        Ok::<Vec<PackageDto>, AppError>(out)
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

/// Outdated status for installed packages (`brew outdated --json=v2` — slow,
/// may hit the network). Fetched lazily/in the background; the UI merges it
/// onto the list. Runs off the main thread so it never freezes the app.
#[tauri::command]
pub async fn packages_outdated(ctx: State<'_, AppContext>) -> AppResult<Vec<OutdatedDto>> {
    let brew = brew_bin(&ctx)?.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let json = run_brew(&brew, &["outdated", "--json=v2"]).unwrap_or_default();
        let map = parse_outdated(&json);
        Ok::<Vec<OutdatedDto>, AppError>(
            map.into_iter()
                .map(|(name, (latest_version, pinned))| OutdatedDto {
                    name,
                    latest_version,
                    pinned,
                })
                .collect(),
        )
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

/// Installed formulae that depend on `name` (`brew uses --installed`).
#[tauri::command]
pub async fn package_dependents(
    name: String,
    ctx: State<'_, AppContext>,
) -> AppResult<Vec<String>> {
    validate::validate_formula(&name)?;
    let brew = brew_bin(&ctx)?.to_string();
    // Off the main thread — `brew uses` shells out and would freeze the UI.
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_brew(&brew, &["uses", "--installed", &name])?;
        Ok::<Vec<String>, AppError>(
            out.lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .map(String::from)
                .collect(),
        )
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

// async so the long `brew upgrade`/`update` subprocess runs off the main thread
// (a sync command blocks it → frozen UI). Same reason as the service commands.
#[tauri::command]
pub async fn upgrade_package(
    name: String,
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    validate::validate_formula(&name)?;
    run_brew(brew_bin(&ctx)?, &["upgrade", &name])?;
    Ok(())
}

#[tauri::command]
pub async fn upgrade_all(ctx: State<'_, AppContext>, lock: State<'_, BrewLock>) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    run_brew(brew_bin(&ctx)?, &["upgrade"])?;
    Ok(())
}

/// `brew update` — refresh formula definitions (does not upgrade packages).
#[tauri::command]
pub async fn update_homebrew(
    ctx: State<'_, AppContext>,
    lock: State<'_, BrewLock>,
) -> AppResult<()> {
    let _g = lock
        .0
        .lock()
        .map_err(|_| AppError::Io("brew lock poisoned".into()))?;
    run_brew(brew_bin(&ctx)?, &["update"])?;
    Ok(())
}

#[tauri::command]
pub async fn package_info(name: String, ctx: State<'_, AppContext>) -> AppResult<PackageInfo> {
    validate::validate_formula(&name)?;
    let brew = brew_bin(&ctx)?.to_string();
    // Off the main thread — `brew info` shells out (may hit the network) and would freeze the UI.
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_brew(&brew, &["info", "--json=v2", &name])?;
        let v: serde_json::Value = serde_json::from_str(&out)
            .map_err(|e| AppError::Parse(format!("brew info json: {e}")))?;

        let (item, is_cask) = match v["formulae"].get(0) {
            Some(f) => (f, false),
            None => (
                v["casks"]
                    .get(0)
                    .ok_or_else(|| AppError::NotFound(format!("no info for {name}")))?,
                true,
            ),
        };

        let str_field = |k: &str| item[k].as_str().map(String::from);
        let dependencies = item["dependencies"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|d| d.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok::<PackageInfo, AppError>(PackageInfo {
            name,
            description: str_field("desc"),
            homepage: str_field("homepage"),
            version: item["versions"]["stable"].as_str().map(String::from),
            dependencies,
            is_service: !item["service"].is_null(),
            is_cask,
        })
    })
    .await
    .map_err(|e| AppError::Shell(format!("brew task failed: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_installed_line() {
        assert_eq!(
            parse_installed_line("redis 8.8.0"),
            Some(("redis".into(), "8.8.0".into()))
        );
        assert_eq!(
            parse_installed_line("openssl@3 3.5.0 3.4.1"),
            Some(("openssl@3".into(), "3.5.0, 3.4.1".into()))
        );
    }

    #[test]
    fn parses_outdated_fixture() {
        let m = parse_outdated(include_str!("../../../fixtures/brew-outdated.json"));
        // assimp was outdated 5.4.3 → 6.0.5 in the captured fixture
        let (v, _) = m.get("assimp").expect("assimp outdated");
        assert_eq!(v.as_deref(), Some("6.0.5"));
    }

    // Real-machine: parse the actual installed list. Ignored in CI.
    #[test]
    #[ignore]
    fn lists_real_packages() {
        let out = std::process::Command::new("/opt/homebrew/bin/brew")
            .args(["list", "--formula", "--versions"])
            .output()
            .unwrap();
        let count = String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(parse_installed_line)
            .count();
        println!("{count} formulae");
        assert!(count > 50, "expected many installed formulae");
    }
}
