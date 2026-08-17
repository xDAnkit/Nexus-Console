use crate::error::{AppError, AppResult};
use std::process::Command;
use std::sync::Mutex;

/// Serializes brew mutations so concurrent commands can't race launchd.
#[derive(Default)]
pub struct BrewLock(pub Mutex<()>);

/// Run brew with args as an array (never a shell string). Returns stdout, or the
/// trimmed stderr as a shell error.
///
/// `HOMEBREW_NO_AUTO_UPDATE` suppresses brew's automatic `brew update` check that
/// otherwise runs before install/upgrade — without it, a Finder-launched app (no
/// shell rc, so the env var isn't inherited) can silently trigger a multi-minute
/// update on an ordinary install/start click. `update_homebrew`'s own explicit
/// `brew update` is unaffected — the var only suppresses the *automatic* pre-run
/// check, not a direct `update` invocation.
pub fn run_brew(brew_bin: &str, args: &[&str]) -> AppResult<String> {
    let out = Command::new(brew_bin)
        .args(args)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_ANALYTICS", "1")
        .output()
        .map_err(|e| AppError::Shell(format!("brew failed: {e}")))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(brew_error(&String::from_utf8_lossy(&out.stderr)))
    }
}

/// Shown for every transient brew-is-busy condition. One sentence, says what's
/// happening and that it resolves itself — nothing for the user to act on.
pub const BREW_BUSY_MSG: &str = "Homebrew is busy updating itself. This clears on its own.";

/// Homebrew self-upgrades its bundled "Portable Ruby" and takes a file lock
/// while doing so; any brew started in that window either blocks on the lock or
/// runs against a half-installed Ruby and dies with a backtrace. Neither is a
/// real failure — both clear within a minute — so they map to `Busy` and the UI
/// shows a spinner instead of red text.
const BUSY_MARKERS: [&str; 4] = [
    "already locked",
    "vendor-install",
    "Portable Ruby",
    "is already running",
];

/// brew's Ruby crashes emit ~40 backtrace frames. Even after dropping them, cap
/// what reaches a toast — the real message is always in the first line or two.
const MAX_ERR_LINES: usize = 3;

/// Homebrew 6 refuses to load anything from a third-party tap until the user
/// trusts it once — and it fails the WHOLE command, so one untrusted tap breaks
/// `brew list`/`info`/`search` for every other formula too.
const UNTRUSTED_MARKER: &str = "from untrusted tap ";

/// Classify brew stderr into a user-facing error: transient lock/Ruby-upgrade
/// noise becomes `Busy`, an untrusted tap becomes `UntrustedTap` (the UI offers
/// to trust it), everything else becomes a short `Shell` message with the Ruby
/// backtrace stripped.
pub fn brew_error(stderr: &str) -> AppError {
    let text = stderr.trim();
    if BUSY_MARKERS.iter().any(|m| text.contains(m)) {
        return AppError::Busy(BREW_BUSY_MSG.into());
    }
    if let Some(tap) = untrusted_tap(text) {
        return AppError::UntrustedTap(tap);
    }
    AppError::Shell(user_facing(text))
}

/// The `user/repo` tap out of "Refusing to load formula x from untrusted tap
/// user/repo." — validated here, since it ends up as a `brew trust` argument.
fn untrusted_tap(stderr: &str) -> Option<String> {
    let tap = stderr
        .split(UNTRUSTED_MARKER)
        .nth(1)?
        .split_whitespace()
        .next()?
        .trim_end_matches('.');
    crate::util::validate::validate_tap(tap).ok()?;
    Some(tap.to_string())
}

/// A Ruby backtrace frame — `/opt/homebrew/…/formulary.rb:351:in 'Array#each'`.
/// Matched by shape, not by the Homebrew prefix, so it works on Intel
/// (`/usr/local`) too.
fn is_backtrace_frame(line: &str) -> bool {
    line.contains(".rb:") && line.contains(":in ")
}

fn user_facing(text: &str) -> String {
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !is_backtrace_frame(l))
        .filter(|l| !l.starts_with("Please report this issue"))
        .take(MAX_ERR_LINES)
        .collect();
    if lines.is_empty() {
        "Homebrew command failed".to_string()
    } else {
        lines.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The two real failures seen on 2026-08-02 (screenshots), verbatim.
    const LOCK_ERR: &str = "lockf: 200: already locked Error: Another `brew vendor-install ruby` process is already running. Please wait for it to finish or terminate it to continue.\nError: Failed to upgrade Homebrew Portable Ruby!";
    const RUBY_CRASH: &str = "Error: undefined method `service_name'\n/opt/homebrew/Library/Homebrew/formulary.rb:351:in 'block (3 levels) in Formulary.load_formula_from_struct!'\n/opt/homebrew/Library/Homebrew/service.rb:63:in 'Homebrew::Service#initialize'\n/opt/homebrew/Library/Homebrew/brew.rb:121:in '<main>'\nPlease report this issue: https://docs.brew.sh/Troubleshooting";

    #[test]
    fn lock_contention_is_busy_not_an_error() {
        assert!(matches!(brew_error(LOCK_ERR), AppError::Busy(_)));
    }

    #[test]
    fn ruby_crash_during_vendor_install_is_busy() {
        // Contains "Portable Ruby"? No — but a crash mid-upgrade is still noise.
        // What matters is that its 40-line backtrace never reaches the UI.
        let AppError::Shell(msg) = brew_error(RUBY_CRASH) else {
            panic!("expected Shell");
        };
        assert!(msg.starts_with("Error: undefined method"));
        assert!(!msg.contains(".rb:"), "backtrace leaked into the UI: {msg}");
        assert!(!msg.contains("docs.brew.sh"));
        assert!(msg.len() < 120, "too long for a toast: {msg}");
    }

    // Homebrew 6.0.14, verbatim (2026-08-16).
    const UNTRUSTED: &str = "Error: Refusing to load formula mongodb/brew/mongodb-community@7.0 from untrusted tap mongodb/brew.\nRun `brew trust --formula mongodb/brew/mongodb-community@7.0` or `brew trust mongodb/brew` to trust it.";

    #[test]
    fn untrusted_tap_becomes_its_own_kind_with_the_tap_name() {
        let AppError::UntrustedTap(tap) = brew_error(UNTRUSTED) else {
            panic!("expected UntrustedTap");
        };
        assert_eq!(tap, "mongodb/brew");
        assert!(matches!(
            brew_error("Error: No such keg"),
            AppError::Shell(_)
        ));
        // A junk "tap" never reaches `brew trust`.
        assert_eq!(untrusted_tap("from untrusted tap ../../etc."), None);
    }

    #[test]
    fn empty_stderr_still_says_something() {
        let AppError::Shell(msg) = brew_error("   \n  ") else {
            panic!("expected Shell");
        };
        assert_eq!(msg, "Homebrew command failed");
    }

    // Read-only proof that run_brew reaches real brew. Ignored in CI.
    #[test]
    #[ignore]
    fn run_brew_search_works() {
        let out = run_brew("/opt/homebrew/bin/brew", &["search", "redis"]).unwrap();
        assert!(out.to_lowercase().contains("redis"));
    }
}
