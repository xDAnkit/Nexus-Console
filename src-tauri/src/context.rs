use std::path::Path;
use std::process::Command;

/// Machine/runtime config discovered once at startup. brew* are `None` when
/// Homebrew isn't found — the UI degrades to a "not detected" state.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppContext {
    pub platform: String,
    pub arch: String,
    pub brew_prefix: Option<String>,
    pub brew_bin: Option<String>,
    pub brew_version: Option<String>,
}

/// `brew --version` result, resolved off the startup path — the subprocess costs
/// 100-500ms and would otherwise block first paint (setup() runs before the event
/// loop). Filled by a spawn_blocking task in setup; `None` until it lands.
#[derive(Default)]
pub struct BrewVersion(pub std::sync::RwLock<Option<String>>);

/// Arch-first brew prefix probe: Apple Silicon → /opt/homebrew, Intel → /usr/local.
/// Honors HOMEBREW_PREFIX as a fallback. Never hardcode the prefix downstream.
pub fn discover() -> AppContext {
    let platform = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let candidates: &[&str] = if arch == "aarch64" {
        &["/opt/homebrew", "/usr/local"]
    } else {
        &["/usr/local", "/opt/homebrew"]
    };

    let mut brew_prefix = None;
    let mut brew_bin = None;
    for prefix in candidates {
        let bin = format!("{prefix}/bin/brew");
        if Path::new(&bin).exists() {
            brew_prefix = Some((*prefix).to_string());
            brew_bin = Some(bin);
            break;
        }
    }
    if brew_bin.is_none() {
        if let Ok(prefix) = std::env::var("HOMEBREW_PREFIX") {
            let bin = format!("{prefix}/bin/brew");
            if Path::new(&bin).exists() {
                brew_prefix = Some(prefix);
                brew_bin = Some(bin);
            }
        }
    }

    AppContext {
        platform,
        arch,
        brew_prefix,
        brew_bin,
        // Resolved async after startup (see BrewVersion) — never block paint on it.
        brew_version: None,
    }
}

/// Blocking `brew --version` probe — call from spawn_blocking, never from setup().
pub fn resolve_brew_version(bin: &str) -> Option<String> {
    let out = Command::new(bin).arg("--version").output().ok()?;
    if !out.status.success() {
        return None;
    }
    // "Homebrew 6.0.10" → "6.0.10"
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .map(|l| l.trim().trim_start_matches("Homebrew").trim().to_string())
        .filter(|v| !v.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_camel_case_with_brew() {
        let ctx = AppContext {
            platform: "macos".into(),
            arch: "aarch64".into(),
            brew_prefix: Some("/opt/homebrew".into()),
            brew_bin: Some("/opt/homebrew/bin/brew".into()),
            brew_version: Some("6.0.10".into()),
        };
        let v = serde_json::to_value(&ctx).unwrap();
        assert_eq!(v["platform"], "macos");
        assert_eq!(v["brewPrefix"], "/opt/homebrew");
        assert_eq!(v["brewVersion"], "6.0.10");
    }

    // Real-machine round-trip proof (this Mac has brew). Ignored in CI where
    // brew may be absent. Run with: cargo test -- --ignored
    #[test]
    #[ignore]
    fn discovers_local_brew() {
        let ctx = discover();
        assert_eq!(ctx.platform, "macos");
        assert!(ctx.brew_prefix.is_some(), "brew prefix should be found");
        assert!(
            ctx.brew_version.is_none(),
            "version is resolved async, not in discover()"
        );
        let v = resolve_brew_version(ctx.brew_bin.as_deref().unwrap());
        assert!(v.is_some(), "brew --version should parse");
        println!("discovered: {ctx:?} version: {v:?}");
    }

    #[test]
    fn null_brew_when_absent() {
        let ctx = AppContext {
            platform: "macos".into(),
            arch: "x86_64".into(),
            brew_prefix: None,
            brew_bin: None,
            brew_version: None,
        };
        let v = serde_json::to_value(&ctx).unwrap();
        assert!(v["brewPrefix"].is_null());
    }
}
