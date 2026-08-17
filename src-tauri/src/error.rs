use serde::ser::SerializeStruct;

/// One error type across every command. Serializes to `{ kind, message, detail }`
/// so the JS bridge (ipc-error.ts) can normalize it uniformly.
// ponytail: seeded in P1, consumed by the first shelling command in P2.
#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Shell(String),
    #[error("{0}")]
    Parse(String),
    #[error("{0}")]
    InvalidName(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Io(String),
    /// User dismissed a native confirm — never an actual failure; the
    /// frontend suppresses its toast for this kind.
    #[error("{0}")]
    Cancelled(String),
    /// A formula/cask lives in a third-party tap Homebrew hasn't been told to
    /// trust, so it refuses to load it (Homebrew 6+). The tap name rides in
    /// `detail` so the UI can offer a one-click `brew trust`.
    #[error("Homebrew won't load anything from the untrusted tap “{0}”.")]
    UntrustedTap(String),
    /// Homebrew is mid-operation (our own mutation, or brew upgrading its
    /// bundled Ruby) and can't answer right now. Transient and self-clearing —
    /// the frontend renders it as a calm "working…" state, never a red error.
    #[error("{0}")]
    Busy(String),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            AppError::Shell(_) => "shell",
            AppError::Parse(_) => "parse",
            AppError::InvalidName(_) => "invalidName",
            AppError::Forbidden(_) => "forbidden",
            AppError::NotFound(_) => "notFound",
            AppError::Io(_) => "io",
            AppError::Cancelled(_) => "cancelled",
            AppError::Busy(_) => "busy",
            AppError::UntrustedTap(_) => "untrustedTap",
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("AppError", 3)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        // `detail` normally repeats the message; for an untrusted tap it carries
        // the bare tap name, which the UI needs to offer "Trust <tap>".
        match self {
            AppError::UntrustedTap(tap) => st.serialize_field("detail", tap)?,
            _ => st.serialize_field("detail", &self.to_string())?,
        }
        st.end()
    }
}

#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;
