use crate::error::{AppError, AppResult};
use std::process::Command;
use std::sync::Mutex;

/// Serializes brew mutations so concurrent commands can't race launchd.
#[derive(Default)]
pub struct BrewLock(pub Mutex<()>);

/// Run brew with args as an array (never a shell string). Returns stdout, or the
/// trimmed stderr as a shell error.
pub fn run_brew(brew_bin: &str, args: &[&str]) -> AppResult<String> {
    let out = Command::new(brew_bin)
        .args(args)
        .output()
        .map_err(|e| AppError::Shell(format!("brew failed: {e}")))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(AppError::Shell(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Read-only proof that run_brew reaches real brew. Ignored in CI.
    #[test]
    #[ignore]
    fn run_brew_search_works() {
        let out = run_brew("/opt/homebrew/bin/brew", &["search", "redis"]).unwrap();
        assert!(out.to_lowercase().contains("redis"));
    }
}
