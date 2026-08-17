use crate::error::{AppError, AppResult};

/// One name segment: lowercase alnum + `@ . _ + -`, never leading `.` or `-`
/// (kills `..` traversal and anything that could read as a flag).
fn segment_ok(s: &str) -> bool {
    !s.is_empty()
        && !s.starts_with(['.', '-'])
        && s.bytes().all(|b| {
            b.is_ascii_lowercase()
                || b.is_ascii_digit()
                || matches!(b, b'@' | b'.' | b'_' | b'+' | b'-')
        })
}

/// A formula is either `name` (core) or `user/repo/name` (third-party tap, e.g.
/// `mongodb/brew/mongodb-community@7.0` — what `brew search` prints). Reject
/// anything else — defense-in-depth even though args are always passed as an
/// array (never a shell).
pub fn validate_formula(name: &str) -> AppResult<()> {
    let segs: Vec<&str> = name.split('/').collect();
    if name.len() <= 128 && matches!(segs.len(), 1 | 3) && segs.iter().all(|s| segment_ok(s)) {
        Ok(())
    } else {
        Err(AppError::InvalidName(format!(
            "invalid formula name: {name}"
        )))
    }
}

/// A tap is exactly `user/repo`. Parsed out of brew's stderr, so validate it
/// before it becomes a `brew trust` argument.
pub fn validate_tap(tap: &str) -> AppResult<()> {
    let segs: Vec<&str> = tap.split('/').collect();
    if tap.len() <= 128 && segs.len() == 2 && segs.iter().all(|s| segment_ok(s)) {
        Ok(())
    } else {
        Err(AppError::InvalidName(format!("invalid tap name: {tap}")))
    }
}

/// The formula without its tap prefix — `mongodb/brew/mongodb-community@7.0` →
/// `mongodb-community@7.0`. brew's own output (`services list`, `opt/<name>`)
/// is always bare, so anything that matches or builds a path uses this.
pub fn bare_formula(name: &str) -> &str {
    name.rsplit('/').next().unwrap_or(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_real_formulae() {
        assert!(validate_formula("redis").is_ok());
        assert!(validate_formula("postgresql@18").is_ok());
        assert!(validate_formula("mongodb-community").is_ok());
        // Tap-qualified: what `brew search mongodb` actually prints.
        assert!(validate_formula("mongodb/brew/mongodb-community@7.0").is_ok());
    }

    #[test]
    fn rejects_injection_and_junk() {
        assert!(validate_formula("redis; rm -rf /").is_err());
        assert!(validate_formula("../etc/passwd").is_err());
        assert!(validate_formula("a/../b").is_err());
        assert!(validate_formula("Redis").is_err());
        assert!(validate_formula("").is_err());
        assert!(validate_formula("mongodb/brew").is_err()); // tap, not a formula
        assert!(validate_formula("a/b/c/d").is_err());
    }

    #[test]
    fn taps_are_exactly_user_slash_repo() {
        assert!(validate_tap("mongodb/brew").is_ok());
        assert!(validate_tap("mongodb").is_err());
        assert!(validate_tap("mongodb/brew/x").is_err());
        assert!(validate_tap("../etc").is_err());
    }

    #[test]
    fn strips_the_tap_prefix() {
        assert_eq!(
            bare_formula("mongodb/brew/mongodb-community@7.0"),
            "mongodb-community@7.0"
        );
        assert_eq!(bare_formula("redis"), "redis");
    }
}
