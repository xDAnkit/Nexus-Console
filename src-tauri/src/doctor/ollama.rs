// Phase 4 — ollama_models: saved local models WITHOUT waking the daemon.
// Reads manifest files directly (`ollama list` auto-starts the server — the
// watchman lesson). Sizes come from the manifests themselves; blobs are
// deduped across models, so shared bytes are reported honestly instead of
// double-counted. One finding per model with a Delete fix: deletion runs
// `ollama rm` (it refcounts shared blobs; we never touch blobs ourselves) and
// is allowed to start the daemon — acceptable on an explicit user click,
// never during a scan.

use super::{Finding, Platform, Probe, Scope, Severity, Tag};
use crate::error::{AppError, AppResult};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

const UNIX: &[Platform] = &[Platform::MacOs];
const STALE_DAYS: u64 = 90;

pub const OLLAMA_MODELS: Probe = Probe {
    id: "ollama_models",
    scope: Scope::Disk,
    platforms: UNIX,
    available: ollama_available,
    run: run_ollama_models,
};

fn manifests_dir() -> Option<PathBuf> {
    super::paths::home().map(|h| h.join(".ollama").join("models").join("manifests"))
}

fn ollama_available() -> bool {
    manifests_dir().is_some_and(|d| d.is_dir())
}

pub struct ModelInfo {
    pub name: String,
    pub digests: Vec<(String, u64)>,
    pub pulled_epoch: u64,
    /// Last READ of the model's weights blob (atime) — a much better "last
    /// used" signal than the pull date. Approximate by nature (APFS updates
    /// atime lazily); 0 when unavailable.
    pub last_used_epoch: u64,
    /// Weights blob currently open by some process (lsof on the blob file —
    /// read-only, wakes nothing). True while ollama has the model loaded.
    pub in_use: bool,
}

/// blobs/sha256-<hex> file for a manifest digest ("sha256:<hex>").
fn blob_path(digest: &str) -> Option<PathBuf> {
    let file = digest.replace(':', "-");
    super::paths::home().map(|h| h.join(".ollama").join("models").join("blobs").join(file))
}

/// stat() only — never opens the blob, so atime itself is not disturbed.
fn blob_atime_epoch(digest: &str) -> u64 {
    blob_path(digest)
        .and_then(|p| fs::metadata(p).ok())
        .and_then(|m| m.accessed().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs())
}

/// Is any process holding the blob open right now? `lsof -t <file>` is
/// read-only and file-scoped — it cannot start a daemon (the watchman rule).
fn blob_in_use(digest: &str) -> bool {
    let Some(path) = blob_path(digest) else {
        return false;
    };
    std::process::Command::new("lsof")
        .args(["-t", &path.to_string_lossy()])
        .output()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false)
}

/// The weights layer = the largest blob the manifest references.
fn weights_digest(digests: &[(String, u64)]) -> Option<&str> {
    digests
        .iter()
        .max_by_key(|(_, size)| *size)
        .map(|(d, _)| d.as_str())
}

/// OCI-style manifest → (digest, size) of every referenced blob.
/// Fail-safe: unrecognized shape → None, the model is skipped, never guessed.
fn parse_manifest(raw: &str) -> Option<Vec<(String, u64)>> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let mut out = Vec::new();
    let mut push = |item: &serde_json::Value| -> Option<()> {
        let digest = item.get("digest")?.as_str()?.to_string();
        let size = item.get("size")?.as_u64()?;
        out.push((digest, size));
        Some(())
    };
    push(v.get("config")?)?;
    for layer in v.get("layers")?.as_array()? {
        push(layer)?;
    }
    Some(out)
}

/// Walk manifests/<registry>/<namespace>/<model>/<tag> files.
fn scan_models() -> Vec<ModelInfo> {
    let Some(root) = manifests_dir() else {
        return vec![];
    };
    let mut models = Vec::new();
    let mut stack = vec![(root.clone(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for entry in rd.filter_map(Result::ok) {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue; // .DS_Store and friends
            }
            if path.is_dir() {
                stack.push((path, depth + 1));
            } else if depth >= 3 {
                // <registry>/<namespace>/<model>/<tag>
                let Ok(raw) = fs::read_to_string(&path) else {
                    continue;
                };
                let Some(digests) = parse_manifest(&raw) else {
                    continue;
                };
                let model = dir.file_name().map(|n| n.to_string_lossy().into_owned());
                let Some(model) = model else { continue };
                let weights = weights_digest(&digests).map(str::to_string);
                models.push(ModelInfo {
                    name: format!("{model}:{name}"),
                    pulled_epoch: path
                        .metadata()
                        .ok()
                        .and_then(|m| super::claude::mtime_epoch(&m))
                        .unwrap_or(0),
                    last_used_epoch: weights.as_deref().map_or(0, blob_atime_epoch),
                    in_use: weights.as_deref().is_some_and(blob_in_use),
                    digests,
                });
            }
        }
    }
    models.sort_by(|a, b| a.name.cmp(&b.name));
    models
}

pub struct PerModel {
    pub name: String,
    pub bytes: u64,
    pub age_days: u64,
    pub stale: bool,
    pub last_used_epoch: u64,
    pub pulled_epoch: u64,
    pub in_use: bool,
}

pub struct ModelStats {
    pub total_bytes: u64,
    pub shared_bytes: u64,
    pub models: Vec<PerModel>,
}

/// Blob-dedupe across models: total = unique blob bytes; shared = bytes that
/// more than one model references (counted once).
pub fn stats(models: &[ModelInfo], now_epoch: u64) -> ModelStats {
    let mut refcount: HashMap<&str, (u64, u32)> = HashMap::new();
    for m in models {
        for (digest, size) in &m.digests {
            let e = refcount.entry(digest).or_insert((*size, 0));
            e.1 += 1;
        }
    }
    let total_bytes: u64 = refcount.values().map(|(s, _)| s).sum();
    let shared_bytes: u64 = refcount
        .values()
        .filter(|(_, n)| *n > 1)
        .map(|(s, _)| s)
        .sum();

    let per = models
        .iter()
        .map(|m| {
            let unique: HashSet<&str> = m.digests.iter().map(|(d, _)| d.as_str()).collect();
            let bytes: u64 = unique
                .iter()
                .filter_map(|d| refcount.get(*d).map(|(s, _)| *s))
                .sum();
            // Staleness keys off LAST USE (atime), falling back to pull date.
            let reference = if m.last_used_epoch > 0 {
                m.last_used_epoch
            } else {
                m.pulled_epoch
            };
            let age_days = now_epoch.saturating_sub(reference) / 86_400;
            PerModel {
                name: m.name.clone(),
                bytes,
                age_days,
                stale: age_days > STALE_DAYS && !m.in_use,
                last_used_epoch: m.last_used_epoch,
                pulled_epoch: m.pulled_epoch,
                in_use: m.in_use,
            }
        })
        .collect();
    ModelStats {
        total_bytes,
        shared_bytes,
        models: per,
    }
}

/// One overview line + one row PER MODEL, each with a Delete fix.
fn run_ollama_models() -> Vec<Finding> {
    let models = scan_models();
    if models.is_empty() {
        return vec![]; // installed but no models → nothing to report
    }
    let s = stats(&models, super::claude::now_epoch());
    // Overview carries the worst child severity — a stale model must not hide
    // behind a green summary once the rows nest inside this card.
    let any_stale = s.models.iter().any(|m| m.stale);
    let mut out = vec![Finding {
        probe_id: OLLAMA_MODELS.id,
        scope: OLLAMA_MODELS.scope,
        severity: if any_stale {
            Severity::Yellow
        } else {
            Severity::Green
        },
        tag: Tag::Storage,
        summary: format!(
            "{} ollama model{} · {}{}",
            s.models.len(),
            if s.models.len() == 1 { "" } else { "s" },
            fmt_gb(s.total_bytes),
            if s.shared_bytes > 0 {
                format!(" ({} shared)", fmt_gb(s.shared_bytes))
            } else {
                String::new()
            }
        ),
        explain: "Measured from manifests without waking the daemon; layers shared between \
                  models are counted once. Each model below can be deleted individually."
            .into(),
        guide: None,
        fix: None,
    }];
    for m in &s.models {
        let last_used = if m.in_use {
            "in use right now".to_string()
        } else if m.last_used_epoch > 0 {
            format!("last used {}", super::claude::ago(m.last_used_epoch))
        } else {
            "never used since pull".to_string()
        };
        out.push(Finding {
            probe_id: OLLAMA_MODELS.id,
            scope: OLLAMA_MODELS.scope,
            severity: if m.stale {
                Severity::Yellow
            } else {
                Severity::Green
            },
            tag: Tag::Storage,
            summary: format!(
                "{} · {} · {last_used}{}",
                m.name,
                fmt_gb(m.bytes),
                if m.stale {
                    format!(" — {}d idle", m.age_days)
                } else {
                    String::new()
                }
            ),
            explain: format!(
                "Pulled {} ({}). \"Last used\" is when the weights were last read from disk \
                 (approximate). Deleting frees up to {} — layers shared with other models \
                 survive, `ollama rm` refcounts them safely. Before deleting, check nothing \
                 references this model in project configs or eval scripts.{}",
                super::claude::format_date(m.pulled_epoch),
                super::claude::ago(m.pulled_epoch),
                fmt_gb(m.bytes),
                if m.in_use {
                    " A process is holding this model open right now, so no delete is offered."
                } else {
                    ""
                }
            ),
            guide: None,
            // No delete while something has the model loaded.
            fix: (!m.in_use).then(|| format!("ollama_rm:{}", m.name)),
        });
    }
    out
}

/// Native-confirm copy for a model delete.
pub fn fix_confirmation(model: &str) -> (String, String) {
    (
        format!("Delete {model}?"),
        "Runs `ollama rm` — layers shared with other models are kept. Re-pulling the model \
         downloads it again."
            .into(),
    )
}

/// Delete a model via `ollama rm`. The name is validated against the ACTUAL
/// installed set first — the frontend string is never trusted, and blobs are
/// never touched by hand. May start the ollama daemon: acceptable for an
/// explicit user click (never during a scan).
pub fn delete_model(model: &str) -> AppResult<String> {
    if !scan_models().iter().any(|m| m.name == model) {
        return Err(AppError::NotFound(format!("no such model: {model}")));
    }
    let out = std::process::Command::new("ollama")
        .args(["rm", model])
        .output()
        .map_err(|e| AppError::Shell(format!("ollama: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Shell(
            String::from_utf8_lossy(&out.stderr).trim().to_string(),
        ));
    }
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"ollamaRm","model":"{model}"}}"#,
        super::claude::now_epoch()
    ));
    Ok(format!(
        "Deleted {model} — shared layers (if any) were kept for other models"
    ))
}

fn fmt_gb(bytes: u64) -> String {
    let gb = bytes as f64 / 1e9;
    if gb >= 1.0 {
        format!("{gb:.1} GB")
    } else {
        format!("{:.0} MB", bytes as f64 / 1e6)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = r#"{
      "schemaVersion": 2,
      "config": {"digest": "sha256:cfg", "size": 487},
      "layers": [
        {"digest": "sha256:model", "size": 1929903072},
        {"digest": "sha256:tmpl", "size": 1615}
      ]
    }"#;

    #[test]
    fn parses_manifest_blobs() {
        let blobs = parse_manifest(MANIFEST).unwrap();
        assert_eq!(blobs.len(), 3);
        assert_eq!(blobs[1], ("sha256:model".into(), 1_929_903_072));
        // Fail-safe: unrecognized shapes are refused.
        assert!(parse_manifest(r#"{"layers": "nope"}"#).is_none());
        assert!(parse_manifest("garbage").is_none());
    }

    #[test]
    fn dedupes_shared_blobs_and_flags_stale() {
        let a = ModelInfo {
            name: "a:latest".into(),
            digests: vec![("s:shared".into(), 100), ("s:a".into(), 10)],
            pulled_epoch: 1_000_000,
            last_used_epoch: 0, // never used → staleness falls back to pull date
            in_use: false,
        };
        let b = ModelInfo {
            name: "b:latest".into(),
            digests: vec![("s:shared".into(), 100), ("s:b".into(), 20)],
            pulled_epoch: 1_000_000,
            last_used_epoch: 1_000_000 + 86_400 * 199, // used yesterday
            in_use: false,
        };
        let c = ModelInfo {
            name: "c:latest".into(),
            digests: vec![("s:c".into(), 5)],
            pulled_epoch: 1_000_000,
            last_used_epoch: 0,
            in_use: true, // loaded right now → never stale, no matter the age
        };
        let now = 1_000_000 + 86_400 * 200;
        let s = stats(&[a, b, c], now);
        assert_eq!(s.total_bytes, 135, "shared blob counted once");
        assert_eq!(s.shared_bytes, 100);
        assert!(s.models[0].stale, "old + unused → stale");
        assert!(!s.models[1].stale, "recently USED beats old pull date");
        assert!(!s.models[2].stale, "in use → never stale");
        assert_eq!(s.models[0].bytes, 110, "per-model = its own unique view");
    }

    #[test]
    fn delete_rejects_unknown_models_before_spawning() {
        assert!(delete_model("definitely-not-installed:v0").is_err());
    }

    // Real machine, read-only — must never wake the ollama daemon (we only
    // read manifest files, so there is nothing here that could).
    #[test]
    fn scans_real_models_without_daemon() {
        let models = scan_models();
        for m in &models {
            assert!(m.name.contains(':'));
            assert!(!m.digests.is_empty());
        }
    }
}
