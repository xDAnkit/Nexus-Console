// Claude Archiver core (PLAN.md Phase 2 — the ⭐).
//
// Safety rules (CTO decisions in PLAN.md):
// - Move-only — the ONE exception is `delete` (bulk archive cleanup), which is
//   explicitly user-confirmed in the UI and journaled like every mutation.
//   A destination that already exists is skipped, not overwritten.
// - Fail-safe: settings.json not the shape we expect → error out, never guess-and-mutate.
// - Every mutation is appended to `<archive-root>/journal.jsonl`.
// - Reads never touch VSCode's state.vscdb here — titles come from the jsonl files
//   themselves (worse than the cache titles, but zero fragile dependencies; the
//   INDEX merge below preserves any better pre-existing titles forever).

use super::paths;
use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// --- DTOs --------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeProject {
    pub dir_name: String,
    pub display_name: String,
    pub real_path: Option<String>,
    pub sessions: u32,
    pub total_bytes: u64,
    pub newest_epoch: Option<u64>,
    /// Measured size of VSCode's session-cache row for this workspace —
    /// None when VSCode has no (recognizable) cache for it.
    pub cache_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveResult {
    pub candidates: Vec<String>,
    pub moved: u32,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkResult {
    pub done: u32,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedChat {
    pub file: String,
    pub epoch: u64,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedProject {
    pub folder: String,
    /// Live project dir this folder maps back to — None means restore target unknown.
    pub dir_name: Option<String>,
    pub total_bytes: u64,
    pub chats: Vec<ArchivedChat>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSettings {
    pub cleanup_period_days: Option<i64>,
    pub archive_root: String,
}

// --- listing -------------------------------------------------------------------

pub fn list_projects() -> AppResult<Vec<ClaudeProject>> {
    let dir = paths::claude_projects_dir().ok_or_else(no_home)?;
    // One workspaceStorage sweep for all projects (the VSCode-cache join).
    let ws_map = super::vscode::workspace_folder_map();
    let mut out = Vec::new();
    for entry in read_dir(&dir)? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().into_owned();
        let (sessions, total_bytes, newest_epoch) = scan_sessions(&path);
        let real = decode_project_path(&dir_name);
        let cache_bytes = real.as_ref().and_then(|p| {
            let ws = &ws_map.iter().find(|(_, folder)| folder == p)?.0;
            Some(super::vscode::session_cache_in(ws)?.bytes)
        });
        out.push(ClaudeProject {
            display_name: real
                .as_ref()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
                .unwrap_or_else(|| fallback_display(&dir_name)),
            real_path: real.map(|p| p.to_string_lossy().into_owned()),
            dir_name,
            sessions,
            total_bytes,
            newest_epoch,
            cache_bytes,
        });
    }
    out.sort_by(|a, b| b.newest_epoch.cmp(&a.newest_epoch));
    Ok(out)
}

fn scan_sessions(project: &Path) -> (u32, u64, Option<u64>) {
    let (mut n, mut bytes, mut newest) = (0u32, 0u64, None::<u64>);
    for f in jsonl_files(project) {
        n += 1;
        if let Ok(meta) = f.metadata() {
            bytes += meta.len();
            let ep = mtime_epoch(&meta);
            if ep > newest {
                newest = ep;
            }
        }
    }
    (n, bytes, newest)
}

// --- archive / restore -----------------------------------------------------------

pub fn archive(dir_name: &str, cutoff_days: u32, apply: bool) -> AppResult<ArchiveResult> {
    validate_name(dir_name)?;
    let src = paths::claude_projects_dir()
        .ok_or_else(no_home)?
        .join(dir_name);
    if !src.is_dir() {
        return Err(AppError::NotFound(format!("no such project: {dir_name}")));
    }
    let now = now_epoch();
    let cutoff = u64::from(cutoff_days) * 86_400;

    // mtime captured BEFORE any move (the bug from the original session).
    let mut candidates: Vec<(PathBuf, String, u64)> = jsonl_files(&src)
        .into_iter()
        .filter_map(|p| {
            let ep = p.metadata().ok().and_then(|m| mtime_epoch(&m))?;
            if now.saturating_sub(ep) <= cutoff {
                return None;
            }
            let name = file_name(&p);
            Some((p, name, ep))
        })
        .collect();
    candidates.sort_by_key(|(_, _, ep)| *ep);

    let names: Vec<String> = candidates.iter().map(|(_, n, _)| n.clone()).collect();
    if !apply {
        return Ok(ArchiveResult {
            candidates: names,
            moved: 0,
            skipped: vec![],
        });
    }

    let res = archive_files(dir_name, &names)?;
    Ok(ArchiveResult {
        candidates: names,
        moved: res.done,
        skipped: res.skipped,
    })
}

/// Move an explicit selection of session files into the archive. The shared
/// mutation core for both cutoff-based and checkbox-based archiving:
/// move-only, never overwrites (existing destination = skip), INDEX regen,
/// journaled.
pub fn archive_files(dir_name: &str, files: &[String]) -> AppResult<BulkResult> {
    validate_name(dir_name)?;
    let src_dir = paths::claude_projects_dir()
        .ok_or_else(no_home)?
        .join(dir_name);
    if !src_dir.is_dir() {
        return Err(AppError::NotFound(format!("no such project: {dir_name}")));
    }
    let folder = archive_folder_name(dir_name);
    let dest_dir = paths::archive_root().ok_or_else(no_home)?.join(&folder);
    fs::create_dir_all(&dest_dir).map_err(io)?;

    let (mut done, mut skipped) = (0u32, Vec::new());
    for file in files {
        let src = src_dir.join(file);
        let dest = dest_dir.join(file);
        if validate_jsonl(file).is_err()
            || !src.is_file()
            || dest.exists()
            || fs::rename(&src, &dest).is_err()
        {
            skipped.push(file.clone());
        } else {
            done += 1;
        }
    }

    regenerate_index(&dest_dir, &folder, dir_name)?;
    journal(&format!(
        r#"{{"tsEpoch":{},"action":"archive","project":"{folder}","moved":{done},"skipped":{}}}"#,
        now_epoch(),
        skipped.len()
    ));
    Ok(BulkResult { done, skipped })
}

/// Live (un-archived) sessions of a project, newest first — same shape as
/// archived chats so the UI renders both sections identically.
pub fn sessions(dir_name: &str) -> AppResult<Vec<ArchivedChat>> {
    validate_name(dir_name)?;
    let dir = paths::claude_projects_dir()
        .ok_or_else(no_home)?
        .join(dir_name);
    if !dir.is_dir() {
        return Err(AppError::NotFound(format!("no such project: {dir_name}")));
    }
    // VSCode's own chat titles beat our first-user-message fallback.
    let cache = decode_project_path(dir_name)
        .and_then(|p| super::vscode::session_cache_for_folder(&p))
        .map(|c| c.titles)
        .unwrap_or_default();
    let mut out: Vec<ArchivedChat> = jsonl_files(&dir)
        .into_iter()
        .map(|f| {
            let stem = f
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            ArchivedChat {
                epoch: f.metadata().ok().and_then(|m| mtime_epoch(&m)).unwrap_or(0),
                title: cache
                    .get(&stem)
                    .cloned()
                    .or_else(|| session_title(&read_head(&f)))
                    .unwrap_or_else(|| "—".into()),
                file: file_name(&f),
            }
        })
        .collect();
    out.sort_by(|a, b| b.epoch.cmp(&a.epoch));
    Ok(out)
}

/// Bulk restore: move files back into the live project. Per-file problems
/// (missing source, destination exists, rename failure) are skips, not aborts.
pub fn restore(dir_name: &str, files: &[String]) -> AppResult<BulkResult> {
    validate_name(dir_name)?;
    let folder = archive_folder_name(dir_name);
    let src_dir = paths::archive_root().ok_or_else(no_home)?.join(&folder);
    let dest_dir = paths::claude_projects_dir()
        .ok_or_else(no_home)?
        .join(dir_name);
    if !dest_dir.is_dir() {
        return Err(AppError::NotFound(format!("no such project: {dir_name}")));
    }
    let (mut done, mut skipped) = (0u32, Vec::new());
    for file in files {
        let src = src_dir.join(file);
        let dest = dest_dir.join(file);
        if validate_jsonl(file).is_err()
            || !src.is_file()
            || dest.exists()
            || fs::rename(&src, &dest).is_err()
        {
            skipped.push(file.clone());
        } else {
            done += 1;
        }
    }
    regenerate_index(&src_dir, &folder, dir_name)?;
    journal(&format!(
        r#"{{"tsEpoch":{},"action":"restore","project":"{folder}","restored":{done},"skipped":{}}}"#,
        now_epoch(),
        skipped.len()
    ));
    Ok(BulkResult { done, skipped })
}

/// Bulk PERMANENT delete from the archive — the only deleting operation in the
/// app, explicitly user-confirmed in the UI and journaled. Works on orphan
/// archive folders too (no live project needed).
pub fn delete(folder: &str, files: &[String]) -> AppResult<BulkResult> {
    validate_name(folder)?;
    let dir = paths::archive_root().ok_or_else(no_home)?.join(folder);
    if !dir.is_dir() {
        return Err(AppError::NotFound(format!(
            "no such archive folder: {folder}"
        )));
    }
    let (mut done, mut skipped) = (0u32, Vec::new());
    for file in files {
        if validate_jsonl(file).is_err() || fs::remove_file(dir.join(file)).is_err() {
            skipped.push(file.clone());
        } else {
            done += 1;
        }
    }
    // INDEX note needs the live project dir if one still maps to this folder.
    let dir_name = list_projects()?
        .into_iter()
        .find(|p| archive_folder_name(&p.dir_name) == folder)
        .map_or_else(|| folder.to_string(), |p| p.dir_name);
    regenerate_index(&dir, folder, &dir_name)?;
    journal(&format!(
        r#"{{"tsEpoch":{},"action":"delete","project":"{folder}","deleted":{done},"skipped":{}}}"#,
        now_epoch(),
        skipped.len()
    ));
    Ok(BulkResult { done, skipped })
}

/// Bulk PERMANENT delete of LIVE (un-archived) chats straight from
/// `~/.claude/projects/<dir_name>/` — the destructive twin of `archive_files`.
/// Confirm-gated in the command layer + journaled, same as archive delete.
pub fn delete_live(dir_name: &str, files: &[String]) -> AppResult<BulkResult> {
    validate_name(dir_name)?;
    let dir = paths::claude_projects_dir()
        .ok_or_else(no_home)?
        .join(dir_name);
    if !dir.is_dir() {
        return Err(AppError::NotFound(format!("no such project: {dir_name}")));
    }
    let (mut done, mut skipped) = (0u32, Vec::new());
    for file in files {
        if validate_jsonl(file).is_err() || fs::remove_file(dir.join(file)).is_err() {
            skipped.push(file.clone());
        } else {
            done += 1;
        }
    }
    journal(&format!(
        r#"{{"tsEpoch":{},"action":"deleteLive","project":"{dir_name}","deleted":{done},"skipped":{}}}"#,
        now_epoch(),
        skipped.len()
    ));
    Ok(BulkResult { done, skipped })
}

pub fn archived() -> AppResult<Vec<ArchivedProject>> {
    let root = paths::archive_root().ok_or_else(no_home)?;
    if !root.is_dir() {
        return Ok(vec![]);
    }
    // Map archive folder → live project dir (for the restore target).
    let by_folder: HashMap<String, String> = list_projects()?
        .into_iter()
        .map(|p| (archive_folder_name(&p.dir_name), p.dir_name))
        .collect();

    let mut out = Vec::new();
    for entry in read_dir(&root)? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().into_owned();
        let titles = parse_index(&fs::read_to_string(path.join("INDEX.md")).unwrap_or_default());
        let mut total_bytes = 0u64;
        let mut chats: Vec<ArchivedChat> = jsonl_files(&path)
            .into_iter()
            .map(|f| {
                let name = file_name(&f);
                let meta = f.metadata().ok();
                total_bytes += meta.as_ref().map_or(0, |m| m.len());
                ArchivedChat {
                    epoch: meta.and_then(|m| mtime_epoch(&m)).unwrap_or(0),
                    title: titles
                        .get(&name)
                        .cloned()
                        .or_else(|| session_title(&read_head(&f)))
                        .unwrap_or_else(|| "—".into()),
                    file: name,
                }
            })
            .collect();
        if chats.is_empty() {
            continue;
        }
        chats.sort_by(|a, b| b.epoch.cmp(&a.epoch));
        out.push(ArchivedProject {
            dir_name: by_folder.get(&folder).cloned(),
            folder,
            total_bytes,
            chats,
        });
    }
    out.sort_by(|a, b| a.folder.cmp(&b.folder));
    Ok(out)
}

// --- retention (settings.json) ---------------------------------------------------

pub fn settings() -> AppResult<ClaudeSettings> {
    let file = paths::claude_settings_file().ok_or_else(no_home)?;
    let days = fs::read_to_string(&file)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| {
            v.get("cleanupPeriodDays")
                .and_then(serde_json::Value::as_i64)
        });
    Ok(ClaudeSettings {
        cleanup_period_days: days,
        archive_root: paths::archive_root()
            .ok_or_else(no_home)?
            .to_string_lossy()
            .into_owned(),
    })
}

pub fn set_retention(days: u32) -> AppResult<()> {
    let file = paths::claude_settings_file().ok_or_else(no_home)?;
    let raw = fs::read_to_string(&file).map_err(io)?;
    let updated = with_retention(&raw, days)?;
    // Backup before editing a file we don't own (kept forever, tiny).
    fs::copy(&file, file.with_extension("json.bak")).map_err(io)?;
    fs::write(&file, updated).map_err(io)?;
    journal(&format!(
        r#"{{"tsEpoch":{},"action":"setRetention","days":{days}}}"#,
        now_epoch()
    ));
    Ok(())
}

/// Pure: parse-modify-write, preserving every other key. Fail-safe: anything
/// other than a JSON object at the top level is "unrecognized" → refuse.
fn with_retention(raw: &str, days: u32) -> AppResult<String> {
    let mut v: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| AppError::Parse(format!("settings.json: {e}")))?;
    let obj = v
        .as_object_mut()
        .ok_or_else(|| AppError::Parse("settings.json: unrecognized shape".into()))?;
    obj.insert("cleanupPeriodDays".into(), serde_json::json!(days));
    serde_json::to_string_pretty(&v).map_err(|e| AppError::Parse(e.to_string()))
}

// --- INDEX.md ---------------------------------------------------------------------

/// Rebuild INDEX.md from the archive dir (source of truth, idempotent).
/// Title priority: VSCode's live cache label (best — and present at exactly
/// the moment a chat gets archived) → the existing INDEX row (preserves good
/// titles after the cache forgets them) → our jsonl head scan.
fn regenerate_index(dir: &Path, folder: &str, project_dir_name: &str) -> AppResult<()> {
    let index_path = dir.join("INDEX.md");
    let existing = parse_index(&fs::read_to_string(&index_path).unwrap_or_default());
    let cache = decode_project_path(project_dir_name)
        .and_then(|p| super::vscode::session_cache_for_folder(&p))
        .map(|c| c.titles)
        .unwrap_or_default();
    let mut rows: Vec<(u64, String, String)> = jsonl_files(dir)
        .into_iter()
        .map(|f| {
            let name = file_name(&f);
            let stem = f
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            let epoch = f.metadata().ok().and_then(|m| mtime_epoch(&m)).unwrap_or(0);
            let title = cache
                .get(&stem)
                .cloned()
                .or_else(|| existing.get(&name).cloned())
                .or_else(|| session_title(&read_head(&f)))
                .unwrap_or_else(|| "—".into());
            (epoch, title, name)
        })
        .collect();
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    fs::write(&index_path, render_index(folder, project_dir_name, &rows)).map_err(io)
}

fn render_index(folder: &str, project_dir_name: &str, rows: &[(u64, String, String)]) -> String {
    let mut s = format!(
        "# Claude chat archive — {folder}\n\nTo restore: move the file back to\n\
         `~/.claude/projects/{project_dir_name}/` and restart VSCode.\n\n\
         | Date | Chat | File |\n|---|---|---|\n"
    );
    for (epoch, title, file) in rows {
        s.push_str(&format!(
            "| {} | {} | {} |\n",
            format_date(*epoch),
            title,
            file
        ));
    }
    s
}

/// file → title map from an existing INDEX.md table (tolerant of missing file).
fn parse_index(md: &str) -> HashMap<String, String> {
    md.lines()
        .filter_map(|l| {
            let cells: Vec<&str> = l.split('|').map(str::trim).collect();
            // "| date | title | file |" splits into ["", date, title, file, ""]
            (cells.len() == 5 && cells[3].ends_with(".jsonl"))
                .then(|| (cells[3].to_string(), cells[2].to_string()))
        })
        .collect()
}

// --- title extraction ----------------------------------------------------------------

/// Best-effort chat title from the head of a session .jsonl: a `summary` line
/// wins, else the first real user message, truncated.
fn session_title(head: &str) -> Option<String> {
    let mut user_msg: Option<String> = None;
    for line in head.lines().take(40) {
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        match v.get("type").and_then(serde_json::Value::as_str) {
            Some("summary") => {
                if let Some(s) = v.get("summary").and_then(serde_json::Value::as_str) {
                    return Some(truncate(s, 60));
                }
            }
            Some("user") if user_msg.is_none() => {
                let content = v.get("message").and_then(|m| m.get("content"));
                let text = match content {
                    Some(serde_json::Value::String(s)) => Some(s.clone()),
                    Some(serde_json::Value::Array(a)) => a.iter().find_map(|c| {
                        c.get("text")
                            .and_then(serde_json::Value::as_str)
                            .map(String::from)
                    }),
                    _ => None,
                };
                if let Some(t) = text {
                    let t = t.trim();
                    if !t.is_empty() && !t.starts_with('<') {
                        user_msg = Some(truncate(t, 60));
                    }
                }
            }
            _ => {}
        }
    }
    user_msg
}

fn truncate(s: &str, max: usize) -> String {
    let clean = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.chars().count() <= max {
        clean
    } else {
        let cut: String = clean.chars().take(max - 1).collect();
        format!("{}…", cut.trim_end())
    }
}

// --- path decode ------------------------------------------------------------------

/// `~/.claude/projects` dir names are the project path with `/` and `.`
/// flattened to `-` — ambiguous with real dashes ("9-June"). Decode by walking
/// the filesystem: at each level, the longest existing entry whose encoded
/// form prefixes the remainder wins.
fn decode_project_path(dir_name: &str) -> Option<PathBuf> {
    let rest = dir_name.strip_prefix('-')?;
    walk_decode(Path::new("/"), rest)
}

/// Claude's encoding maps EVERY non-alphanumeric char to '-' (spaces, dots,
/// underscores — "VSS Batches" → "VSS-Batches", "Draw.io" → "Draw-io").
fn encode_segment(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

fn walk_decode(base: &Path, rest: &str) -> Option<PathBuf> {
    let mut entries: Vec<String> = fs::read_dir(base)
        .ok()?
        .filter_map(|e| e.ok().map(|e| e.file_name().to_string_lossy().into_owned()))
        .collect();
    entries.sort_by_key(|e| std::cmp::Reverse(e.len())); // longest match first
    for name in entries {
        let enc = encode_segment(&name);
        if rest == enc {
            return Some(base.join(name));
        }
        if let Some(tail) = rest.strip_prefix(&format!("{enc}-")) {
            if let Some(found) = walk_decode(&base.join(&name), tail) {
                return Some(found);
            }
        }
    }
    None
}

/// Display fallback when the original folder no longer exists: drop the
/// encoded home prefix so "-Users-x-Documents-Foo-Bar" reads "Documents-Foo-Bar".
fn fallback_display(dir_name: &str) -> String {
    let raw = dir_name.trim_start_matches('-');
    paths::home()
        .map(|h| encode_segment(h.to_string_lossy().trim_start_matches('/')))
        .and_then(|home_enc| raw.strip_prefix(&format!("{home_enc}-")).map(String::from))
        .unwrap_or_else(|| raw.to_string())
}

/// Archive folder = last real path segment ("9-June", matching the live archive).
// ponytail: two projects with the same basename would share a folder — files are
// uuid-named so nothing collides destructively; revisit if it ever happens.
fn archive_folder_name(dir_name: &str) -> String {
    decode_project_path(dir_name)
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
        .unwrap_or_else(|| dir_name.trim_start_matches('-').to_string())
}

// --- small shared helpers -------------------------------------------------------------

fn jsonl_files(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().is_some_and(|e| e == "jsonl"))
                .collect()
        })
        .unwrap_or_default()
}

fn read_head(path: &Path) -> String {
    let mut buf = vec![0u8; 64 * 1024];
    let n = fs::File::open(path)
        .and_then(|mut f| f.read(&mut buf))
        .unwrap_or(0);
    String::from_utf8_lossy(&buf[..n]).into_owned()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub ts_epoch: u64,
    pub action: String,
    pub detail: String,
}

/// The mutation audit trail, newest first. Unparseable lines are skipped
/// (the journal is append-only best-effort, never a source of failures).
pub fn read_journal(limit: usize) -> Vec<JournalEntry> {
    let Some(root) = paths::archive_root() else {
        return vec![];
    };
    let Ok(raw) = fs::read_to_string(root.join("journal.jsonl")) else {
        return vec![];
    };
    let mut out: Vec<JournalEntry> = raw.lines().filter_map(parse_journal_line).collect();
    out.reverse();
    out.truncate(limit);
    out
}

fn parse_journal_line(line: &str) -> Option<JournalEntry> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    let obj = v.as_object()?;
    let detail = obj
        .iter()
        .filter(|(k, _)| k.as_str() != "tsEpoch" && k.as_str() != "action")
        .map(|(k, val)| match val {
            serde_json::Value::String(s) => format!("{k} {s}"),
            other => format!("{k} {other}"),
        })
        .collect::<Vec<_>>()
        .join(" · ");
    Some(JournalEntry {
        ts_epoch: obj.get("tsEpoch")?.as_u64()?,
        action: obj.get("action")?.as_str()?.to_string(),
        detail,
    })
}

pub(crate) fn journal(line: &str) {
    // Best-effort by design: a failed journal write must never block the mutation
    // it records (the mutation already happened).
    use std::io::Write;
    if let Some(root) = paths::archive_root() {
        let _ = fs::create_dir_all(&root);
        if let Ok(mut f) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(root.join("journal.jsonl"))
        {
            let _ = writeln!(f, "{line}");
        }
    }
}

fn validate_name(dir_name: &str) -> AppResult<()> {
    if dir_name.is_empty() || dir_name.contains('/') || dir_name.contains("..") {
        return Err(AppError::InvalidName(format!(
            "bad project dir: {dir_name}"
        )));
    }
    Ok(())
}

fn validate_jsonl(file: &str) -> AppResult<()> {
    if file.contains('/') || file.contains("..") || !file.ends_with(".jsonl") {
        return Err(AppError::InvalidName(format!("bad session file: {file}")));
    }
    Ok(())
}

fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

pub(crate) fn mtime_epoch(meta: &fs::Metadata) -> Option<u64> {
    meta.modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

pub(crate) fn now_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

fn read_dir(dir: &Path) -> AppResult<Vec<fs::DirEntry>> {
    Ok(fs::read_dir(dir)
        .map_err(io)?
        .filter_map(Result::ok)
        .collect())
}

fn no_home() -> AppError {
    AppError::NotFound("HOME not set".into())
}

fn io(e: std::io::Error) -> AppError {
    AppError::Io(e.to_string())
}

/// Human relative time, pure for testing: "just now" · "5h ago" · "yesterday"
/// · "12 days ago" · "3 weeks ago" · "4 months ago".
pub(crate) fn ago_at(epoch: u64, now: u64) -> String {
    let d = now.saturating_sub(epoch);
    let days = d / 86_400;
    match () {
        _ if d < 3_600 => "just now".into(),
        _ if days == 0 => format!("{}h ago", d / 3_600),
        _ if days == 1 => "yesterday".into(),
        _ if days < 14 => format!("{days} days ago"),
        _ if days < 61 => format!("{} weeks ago", days / 7),
        _ => format!("{} months ago", days / 30),
    }
}

pub(crate) fn ago(epoch: u64) -> String {
    ago_at(epoch, now_epoch())
}

/// Epoch secs → "15 Jul 2026" (days-from-civil inverse, no chrono dep).
pub(crate) fn format_date(epoch: u64) -> String {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let days = (epoch / 86_400) as i64;
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{d} {} {y}", MONTHS[(m - 1) as usize])
}

#[cfg(test)]
mod tests {
    use super::*;

    // Strictly read-only smoke against this machine's real ~/.claude + archive:
    // listing, decode, INDEX/title parsing, and a dry-run archive preview.
    #[test]
    fn real_machine_read_only_smoke() {
        let projects = list_projects().unwrap();
        if projects.is_empty() {
            return; // machine without Claude Code — nothing to smoke-test
        }
        assert!(
            archive(&projects[0].dir_name, 30, false).is_ok(),
            "dry-run must not error"
        );
        assert!(
            sessions(&projects[0].dir_name).is_ok(),
            "live sessions listing must not error"
        );
        for p in archived().unwrap() {
            assert!(!p.chats.is_empty());
        }
    }

    #[test]
    fn title_prefers_summary() {
        let head = r#"{"type":"queue-operation","operation":"enqueue"}
{"type":"summary","summary":"Fix permission-driven button visibility"}
{"type":"user","message":{"role":"user","content":"hello"}}"#;
        assert_eq!(
            session_title(head).unwrap(),
            "Fix permission-driven button visibility"
        );
    }

    #[test]
    fn title_falls_back_to_first_user_message() {
        let head = r#"{"type":"queue-operation"}
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"  make the sidebar   collapsible please "}]}}"#;
        assert_eq!(
            session_title(head).unwrap(),
            "make the sidebar collapsible please"
        );
        assert_eq!(session_title("not json\n{}"), None);
    }

    #[test]
    fn title_truncates_long_messages() {
        let long = "x".repeat(100);
        let head = format!(r#"{{"type":"user","message":{{"content":"{long}"}}}}"#);
        let t = session_title(&head).unwrap();
        assert!(t.chars().count() <= 60 && t.ends_with('…'));
    }

    #[test]
    fn index_roundtrip_preserves_titles() {
        let md = render_index(
            "9-June",
            "-Users-x-9-June",
            &[(
                1_784_246_400,
                "A nice cached title".into(),
                "abc.jsonl".into(),
            )],
        );
        let map = parse_index(&md);
        assert_eq!(map.get("abc.jsonl").unwrap(), "A nice cached title");
    }

    #[test]
    fn relative_time_buckets() {
        let now = 1_784_298_765;
        assert_eq!(ago_at(now - 120, now), "just now");
        assert_eq!(ago_at(now - 5 * 3_600, now), "5h ago");
        assert_eq!(ago_at(now - 86_400, now), "yesterday");
        assert_eq!(ago_at(now - 3 * 86_400, now), "3 days ago");
        assert_eq!(ago_at(now - 21 * 86_400, now), "3 weeks ago");
        assert_eq!(ago_at(now - 120 * 86_400, now), "4 months ago");
    }

    #[test]
    fn date_formats_civil() {
        assert_eq!(format_date(1_784_246_400), "17 Jul 2026");
        assert_eq!(format_date(0), "1 Jan 1970");
    }

    #[test]
    fn retention_edit_preserves_other_keys() {
        let raw = r#"{ "permissions": {"allow": ["x"]}, "cleanupPeriodDays": 30 }"#;
        let out = with_retention(raw, 3650).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["cleanupPeriodDays"], 3650);
        assert_eq!(v["permissions"]["allow"][0], "x");
        assert!(
            with_retention("[1,2]", 5).is_err(),
            "non-object must be refused"
        );
    }

    #[test]
    fn parses_journal_lines() {
        let e = parse_journal_line(
            r#"{"tsEpoch":1784298765,"action":"archive","project":"9-June","moved":12,"skipped":0}"#,
        )
        .unwrap();
        assert_eq!(e.action, "archive");
        assert_eq!(e.ts_epoch, 1_784_298_765);
        assert!(e.detail.contains("project 9-June") && e.detail.contains("moved 12"));
        assert!(parse_journal_line("not json").is_none());
        assert!(parse_journal_line(r#"{"noAction":true}"#).is_none());
    }

    #[test]
    fn validates_names() {
        assert!(validate_name("-Users-x-proj").is_ok());
        assert!(validate_name("../etc").is_err());
        assert!(validate_jsonl("a.jsonl").is_ok());
        assert!(validate_jsonl("../a.jsonl").is_err());
        assert!(validate_jsonl("a.txt").is_err());
    }

    #[test]
    fn encodes_every_non_alphanumeric_as_dash() {
        assert_eq!(encode_segment("VSS Batches"), "VSS-Batches");
        assert_eq!(encode_segment("Draw.io"), "Draw-io");
        assert_eq!(encode_segment("nexus_fe"), "nexus-fe");
        assert_eq!(encode_segment("9-June"), "9-June");
    }

    #[test]
    fn fallback_display_strips_encoded_home() {
        let home = std::env::var("HOME").unwrap();
        let dir = format!("{}-Documents-Foo-Bar", encode_segment(&home));
        assert_eq!(fallback_display(&dir), "Documents-Foo-Bar");
        assert_eq!(fallback_display("-Volumes-X-proj"), "Volumes-X-proj");
    }

    // Real-fs decode: HOME itself roundtrips through the encoding.
    #[test]
    fn decodes_encoded_home() {
        let home = std::env::var("HOME").unwrap();
        let encoded = home.replace(['/', '.'], "-");
        assert_eq!(
            decode_project_path(&encoded).unwrap().to_string_lossy(),
            home
        );
    }
}
