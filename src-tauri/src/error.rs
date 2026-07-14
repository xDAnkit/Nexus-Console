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
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("AppError", 3)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        st.serialize_field("detail", &self.to_string())?;
        st.end()
    }
}

#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;
