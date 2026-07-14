use crate::error::{AppError, AppResult};

/// Homebrew formula names are lowercase alnum + `@ . _ + -`. Reject anything else —
/// defense-in-depth even though args are always passed as an array (never a shell).
pub fn validate_formula(name: &str) -> AppResult<()> {
    let ok = !name.is_empty()
        && name.len() <= 128
        && name.bytes().all(|b| {
            b.is_ascii_lowercase()
                || b.is_ascii_digit()
                || matches!(b, b'@' | b'.' | b'_' | b'+' | b'-')
        });
    if ok {
        Ok(())
    } else {
        Err(AppError::InvalidName(format!(
            "invalid formula name: {name}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_real_formulae() {
        assert!(validate_formula("redis").is_ok());
        assert!(validate_formula("postgresql@18").is_ok());
        assert!(validate_formula("mongodb-community").is_ok());
    }

    #[test]
    fn rejects_injection_and_junk() {
        assert!(validate_formula("redis; rm -rf /").is_err());
        assert!(validate_formula("../etc/passwd").is_err());
        assert!(validate_formula("Redis").is_err());
        assert!(validate_formula("").is_err());
    }
}
