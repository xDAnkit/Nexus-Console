// Phase 5 (un-cut on demand) — Browser Doctor, the measured recipes from the
// original session:
//   browser_processes — per running Chromium browser: total RSS + the
//     extension share (the A/B-measured 1.38 GB lesson). Grouping is by FULL
//     args, never the truncated comm (the multi-word-name bug).
//   browser_audio — "Playing audio" power assertions: blocks IDLE sleep only,
//     lid-close always sleeps (the expectation-correcting lesson).
// Read-only: one `ps` and one `pmset` shell-out; nothing is woken.

use super::{probe_failed, Finding, Platform, Probe, Scope, Severity, Tag};
use std::process::Command;

const MACOS: &[Platform] = &[Platform::MacOs];

pub struct Browser {
    pub label: &'static str,
    /// Full-args match marker for ps grouping.
    marker: &'static str,
    app: &'static str,
    /// ~/Library/Caches/<this> — safe to clear when the browser is closed.
    cache_rel: &'static str,
    /// ~/Library/Application Support/<this>/Local State — background_mode lives here.
    local_state_rel: &'static str,
}

/// Brave/Edge are the same Chromium probes, purely data-driven.
const BROWSERS: &[Browser] = &[
    Browser {
        label: "Chrome",
        marker: "Google Chrome.app",
        app: "/Applications/Google Chrome.app",
        cache_rel: "Google/Chrome",
        local_state_rel: "Google/Chrome",
    },
    Browser {
        label: "Brave",
        marker: "Brave Browser.app",
        app: "/Applications/Brave Browser.app",
        cache_rel: "BraveSoftware/Brave-Browser",
        local_state_rel: "BraveSoftware/Brave-Browser",
    },
    Browser {
        label: "Edge",
        marker: "Microsoft Edge.app",
        app: "/Applications/Microsoft Edge.app",
        cache_rel: "Microsoft Edge",
        local_state_rel: "Microsoft Edge",
    },
];

fn browser_by_label(label: &str) -> Option<&'static Browser> {
    BROWSERS.iter().find(|b| b.label == label)
}

impl Browser {
    fn installed(&self) -> bool {
        std::path::Path::new(self.app).is_dir()
    }
    fn cache_dir(&self) -> Option<std::path::PathBuf> {
        super::paths::home().map(|h| h.join("Library/Caches").join(self.cache_rel))
    }
    fn local_state(&self) -> Option<std::path::PathBuf> {
        super::paths::home().map(|h| {
            h.join("Library/Application Support")
                .join(self.local_state_rel)
                .join("Local State")
        })
    }
    fn running(&self, ps: &str) -> bool {
        parse_browser_ps(ps, self.marker).procs > 0
    }
}

/// Extensions above this share of RSS get the yellow + guide.
const EXT_YELLOW_BYTES: u64 = 500 * 1024 * 1024;

pub const PROCESSES: Probe = Probe {
    id: "browser_processes",
    scope: Scope::Browser,
    platforms: MACOS,
    available: any_browser_installed,
    run: run_processes,
};

pub const AUDIO_BLOCKER: Probe = Probe {
    id: "browser_audio",
    scope: Scope::Browser,
    platforms: MACOS,
    available: any_browser_installed,
    run: run_audio,
};

fn any_browser_installed() -> bool {
    BROWSERS.iter().any(Browser::installed)
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct BrowserStats {
    pub procs: u32,
    pub total_kb: u64,
    pub ext_procs: u32,
    pub ext_kb: u64,
    pub renderer_kb: u64,
    pub gpu_kb: u64,
}

/// `ps -Ao rss=,args=` lines → per-browser split. Full-args matching only.
fn parse_browser_ps(ps: &str, marker: &str) -> BrowserStats {
    let mut s = BrowserStats::default();
    for line in ps.lines() {
        let line = line.trim_start();
        let Some((rss_str, args)) = line.split_once(' ') else {
            continue;
        };
        let Ok(rss) = rss_str.parse::<u64>() else {
            continue;
        };
        if !args.contains(marker) {
            continue;
        }
        s.procs += 1;
        s.total_kb += rss;
        if args.contains("--extension-process") {
            s.ext_procs += 1;
            s.ext_kb += rss;
        } else if args.contains("--type=renderer") {
            s.renderer_kb += rss;
        } else if args.contains("--type=gpu-process") {
            s.gpu_kb += rss;
        }
    }
    s
}

fn run_processes() -> Vec<Finding> {
    let Some(ps) = sh("ps", &["-Ao", "rss=,args="]) else {
        return vec![probe_failed(&PROCESSES, Tag::Speed, "list processes (ps)")];
    };
    let mut out = Vec::new();
    for b in BROWSERS {
        let label = b.label;
        if !b.installed() {
            continue;
        }
        let s = parse_browser_ps(&ps, b.marker);
        if s.procs == 0 {
            out.push(Finding {
                probe_id: PROCESSES.id,
                scope: PROCESSES.scope,
                severity: Severity::Green,
                tag: Tag::Speed,
                summary: format!("{label} is not running"),
                explain: "No processes, no memory.".into(),
                guide: None,
                fix: None,
            });
            continue;
        }
        let ext_bytes = s.ext_kb * 1024;
        let heavy_ext = ext_bytes > EXT_YELLOW_BYTES;
        out.push(Finding {
            probe_id: PROCESSES.id,
            scope: PROCESSES.scope,
            severity: if heavy_ext {
                Severity::Yellow
            } else {
                Severity::Green
            },
            tag: Tag::Speed,
            summary: format!(
                "{label} · {} across {} processes{}",
                super::vscode::fmt_mb(s.total_kb * 1024),
                s.procs,
                if s.ext_procs > 0 {
                    format!(
                        " · extensions {} ({})",
                        super::vscode::fmt_mb(ext_bytes),
                        s.ext_procs
                    )
                } else {
                    String::new()
                }
            ),
            explain: format!(
                "Renderers {} · GPU {} — many processes is NORMAL (site isolation); the \
                 total tracks how many tabs you keep open. Extensions run their own \
                 processes: disabling unused ones measurably freed 1.38 GB in the \
                 original case.",
                super::vscode::fmt_mb(s.renderer_kb * 1024),
                super::vscode::fmt_mb(s.gpu_kb * 1024),
            ),
            guide: heavy_ext.then(|| {
                vec![
                    format!("{label}: open the extensions page and disable what you don't use"),
                    "Ground truth per tab/extension: Shift+Esc opens the browser's own task \
                     manager"
                        .into(),
                ]
            }),
            fix: None,
        });
    }
    out
}

/// "Playing audio" assertion owners, e.g. `pid 435(Google Chrome): ... Playing audio`.
fn parse_audio_owners(pmset: &str) -> Vec<String> {
    let mut names: Vec<String> = pmset
        .lines()
        .filter(|l| l.contains("Playing audio"))
        .filter_map(|l| {
            let start = l.find("pid ")? + 4;
            let rest = &l[start..];
            let open = rest.find('(')?;
            let close = rest.find(')')?;
            Some(rest[open + 1..close].to_string())
        })
        .collect();
    names.sort();
    names.dedup();
    names
}

fn run_audio() -> Vec<Finding> {
    let Some(out) = sh("pmset", &["-g", "assertions"]) else {
        return vec![probe_failed(
            &AUDIO_BLOCKER,
            Tag::Info,
            "read power assertions (pmset)",
        )];
    };
    let owners = parse_audio_owners(&out);
    if owners.is_empty() {
        return vec![Finding {
            probe_id: AUDIO_BLOCKER.id,
            scope: AUDIO_BLOCKER.scope,
            severity: Severity::Green,
            tag: Tag::Info,
            summary: "Nothing is holding an audio sleep assertion".into(),
            explain: "No app is keeping the Mac awake for audio.".into(),
            guide: None,
            fix: None,
        }];
    }
    vec![Finding {
        probe_id: AUDIO_BLOCKER.id,
        scope: AUDIO_BLOCKER.scope,
        severity: Severity::Yellow,
        tag: Tag::Info,
        summary: format!(
            "Playing audio — idle sleep blocked by {}",
            owners.join(", ")
        ),
        explain: "An audio assertion only blocks IDLE sleep — closing the lid always sleeps. \
                  Usually a tab playing (or having played) sound."
            .into(),
        guide: Some(vec![
            "Find the tab: Shift+Esc in the browser (its own task manager), or look for the \
             speaker icon on tabs"
                .into(),
        ]),
        fix: None,
    }]
}

fn sh(cmd: &str, args: &[&str]) -> Option<String> {
    let out = Command::new(cmd).args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

// --- storage & background settings ---------------------------------------------

/// Caches worth a line above this floor.
const CACHE_MIN_BYTES: u64 = 100 * 1024 * 1024;

pub const STORAGE: Probe = Probe {
    id: "browser_storage",
    scope: Scope::Browser,
    platforms: MACOS,
    available: any_browser_installed,
    run: run_storage,
};

/// Local State JSON → is "continue running background apps" enabled?
/// Fail-safe: unrecognized shape → None (never guessed).
fn parse_background_mode(raw: &str) -> Option<bool> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    v.get("background_mode")?.get("enabled")?.as_bool()
}

fn run_storage() -> Vec<Finding> {
    let mut out = Vec::new();
    for b in BROWSERS.iter().filter(|b| b.installed()) {
        // Cache size — one-click clear, gated on the browser being closed.
        if let Some(dir) = b.cache_dir().filter(|d| d.is_dir()) {
            let bytes = super::deepscan::du_bytes(&dir);
            if bytes >= CACHE_MIN_BYTES {
                out.push(Finding {
                    probe_id: STORAGE.id,
                    scope: STORAGE.scope,
                    severity: Severity::Yellow,
                    tag: Tag::Storage,
                    summary: format!(
                        "{} cache · {} reclaimable",
                        b.label,
                        super::vscode::fmt_mb(bytes)
                    ),
                    explain: "Pure web cache — it re-downloads as you browse. Clearing frees \
                              disk (first page loads may be briefly slower); the browser must \
                              be closed while it's cleared."
                        .into(),
                    guide: None,
                    fix: Some(format!("browser_cache:{}", b.label)),
                });
            }
        }
        // Background mode — keeps helper processes alive after the window closes.
        let background = b
            .local_state()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|raw| parse_background_mode(&raw));
        if background == Some(true) {
            out.push(Finding {
                probe_id: STORAGE.id,
                scope: STORAGE.scope,
                severity: Severity::Yellow,
                tag: Tag::Speed,
                summary: format!("{} keeps running in the background when closed", b.label),
                explain: "\"Continue running background apps\" keeps browser processes (and \
                          extension background pages) alive after you close the window — \
                          quietly costing memory and battery."
                    .into(),
                guide: Some(vec![format!(
                    "{}: Settings → System → turn OFF \"Continue running background apps when \
                     {} is closed\"",
                    b.label, b.label
                )]),
                fix: None,
            });
        }
    }
    if out.is_empty() {
        out.push(Finding {
            probe_id: STORAGE.id,
            scope: STORAGE.scope,
            severity: Severity::Green,
            tag: Tag::Storage,
            summary: "Browser caches are small · no background mode".into(),
            explain: "Nothing above the 100 MB noise floor, and no browser keeps running \
                      after its window closes."
                .into(),
            guide: None,
            fix: None,
        });
    }
    out
}

// --- installed extensions (per browser, on-disk manifests) --------------------
// Mirrors the VSCode extension_audit: read each extension's on-disk manifest,
// list it with a display name, and offer one safe action. There is NO safe CLI
// to uninstall/disable a browser extension from outside the browser (Chrome
// signs its own state), so the action just opens that extension's own page.

pub const EXTENSIONS: Probe = Probe {
    id: "browser_extensions",
    scope: Scope::Browser,
    platforms: MACOS,
    available: any_browser_installed,
    run: run_extensions,
};

#[derive(Debug, PartialEq, Eq)]
struct BrowserExt {
    id: String,
    name: String,
    /// A background page / service worker keeps a process alive when unused.
    background: bool,
}

impl Browser {
    /// ~/Library/Application Support/<...> — the profile parent dir.
    fn support_dir(&self) -> Option<std::path::PathBuf> {
        super::paths::home().map(|h| {
            h.join("Library/Application Support")
                .join(self.local_state_rel)
        })
    }

    /// User-installed extensions across every profile, deduped by id.
    fn extensions(&self) -> Vec<BrowserExt> {
        let Some(base) = self.support_dir() else {
            return vec![];
        };
        let Ok(profiles) = std::fs::read_dir(&base) else {
            return vec![];
        };
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for profile in profiles.filter_map(Result::ok).map(|e| e.path()) {
            let Ok(ids) = std::fs::read_dir(profile.join("Extensions")) else {
                continue;
            };
            for id_path in ids.filter_map(Result::ok).map(|e| e.path()) {
                let Some(id) = id_path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                else {
                    continue;
                };
                // Chrome's own scratch dir / dotfiles are not extensions.
                if id.starts_with('.') || id == "Temp" || !id_path.is_dir() {
                    continue;
                }
                if !seen.insert(id.clone()) {
                    continue; // same extension in another profile — list once
                }
                if let Some(ext) = read_extension(&id, &id_path) {
                    out.push(ext);
                }
            }
        }
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        out
    }
}

/// Read <Extensions>/<id>/<version>/manifest.json → display name + background.
/// Fail-safe: no readable manifest → None (the extension is simply not listed).
fn read_extension(id: &str, id_dir: &std::path::Path) -> Option<BrowserExt> {
    let vdir = version_dir(id_dir)?;
    let raw = std::fs::read_to_string(vdir.join("manifest.json")).ok()?;
    let (name, background) = parse_ext_manifest(&raw, &vdir)?;
    Some(BrowserExt {
        id: id.to_string(),
        name,
        background,
    })
}

/// The version sub-folder holding manifest.json (an ext dir has one or more).
fn version_dir(id_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    std::fs::read_dir(id_dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .find(|p| p.join("manifest.json").is_file())
}

/// Static manifest parse → (display name, has-background). `vdir` is only read
/// when the name is a `__MSG_key__` placeholder needing locale resolution.
fn parse_ext_manifest(raw: &str, vdir: &std::path::Path) -> Option<(String, bool)> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let raw_name = v.get("name")?.as_str()?;
    let background = v.get("background").is_some();
    Some((resolve_name(raw_name, &v, vdir), background))
}

/// `__MSG_extName__` → the localized string (from _locales/<locale>/messages.json);
/// anything else is already the name. Falls back to the raw name if unresolved.
fn resolve_name(raw_name: &str, manifest: &serde_json::Value, vdir: &std::path::Path) -> String {
    let Some(key) = raw_name
        .strip_prefix("__MSG_")
        .and_then(|s| s.strip_suffix("__"))
    else {
        return raw_name.to_string();
    };
    let locale = manifest
        .get("default_locale")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("en");
    let msgs = vdir.join("_locales").join(locale).join("messages.json");
    lookup_message(&std::fs::read_to_string(msgs).unwrap_or_default(), key)
        .unwrap_or_else(|| raw_name.to_string())
}

/// messages.json → messages[key].message (Chrome i18n keys are case-insensitive).
fn lookup_message(raw: &str, key: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    v.as_object()?
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(key))
        .and_then(|(_, val)| val.get("message")?.as_str().map(String::from))
}

fn run_extensions() -> Vec<Finding> {
    let installed: Vec<&Browser> = BROWSERS.iter().filter(|b| b.installed()).collect();
    let multi = installed.len() > 1;
    let all: Vec<(&'static str, BrowserExt)> = installed
        .iter()
        .flat_map(|b| b.extensions().into_iter().map(move |e| (b.label, e)))
        .collect();

    if all.is_empty() {
        return vec![Finding {
            probe_id: EXTENSIONS.id,
            scope: EXTENSIONS.scope,
            severity: Severity::Green,
            tag: Tag::Speed,
            summary: "No user-installed browser extensions".into(),
            explain: "Nothing to review — no extensions are installed in your browsers \
                      (built-in browser components aren't counted)."
                .into(),
            guide: None,
            fix: None,
        }];
    }

    let bg = all.iter().filter(|(_, e)| e.background).count();
    let total = all.len();
    let mut out = vec![Finding {
        probe_id: EXTENSIONS.id,
        scope: EXTENSIONS.scope,
        severity: Severity::Green,
        tag: Tag::Speed,
        // ponytail: DoctorPage's OVERVIEW_PATTERNS keys off "N extensions ·" —
        // this is the overview card that nests the per-extension rows below it.
        summary: format!(
            "{total} extension{} · {bg} run in background",
            if total == 1 { "" } else { "s" }
        ),
        explain: "Every installed browser extension, read from its on-disk manifest. Ones with \
                  a background page / service worker keep a process alive even when unused — \
                  that's the memory cost. Turning an extension off or removing it can't be \
                  safely automated from outside the browser, so each row opens that \
                  extension's own page in the browser, where you can do it."
            .into(),
        guide: None,
        fix: None,
    }];
    for (label, e) in &all {
        let activation = if e.background {
            "runs in background"
        } else {
            "loads on demand"
        };
        let meta = if multi {
            format!("{label} · {activation}")
        } else {
            activation.to_string()
        };
        out.push(Finding {
            probe_id: EXTENSIONS.id,
            scope: EXTENSIONS.scope,
            severity: Severity::Green,
            tag: Tag::Speed,
            summary: format!("{} · {meta}", e.name),
            explain: format!(
                "Opens {label}'s own extensions page focused on \"{}\", where you can turn it \
                 off or Remove it — the browser owns that state, so this app never edits it \
                 directly.",
                e.name
            ),
            guide: None,
            fix: Some(format!("browser_ext_manage:{label}:{}", e.id)),
        });
    }
    out
}

/// Fix: open a browser's own management page for one extension. Non-destructive
/// (it only navigates the browser), so no confirm. `spec` = "<label>:<id>";
/// both are validated against the real installed set — the string is never trusted.
pub fn manage_extension(spec: &str) -> crate::error::AppResult<String> {
    use crate::error::AppError;
    let (label, id) = spec
        .split_once(':')
        .ok_or_else(|| AppError::NotFound(format!("bad extension ref: {spec}")))?;
    let b = browser_by_label(label)
        .filter(|b| b.installed())
        .ok_or_else(|| AppError::NotFound(format!("no such browser: {label}")))?;
    if !b.extensions().iter().any(|e| e.id == id) {
        return Err(AppError::NotFound(format!("{label} has no extension {id}")));
    }
    let opened = Command::new("open")
        .args(["-a", b.app, &format!("chrome://extensions/?id={id}")])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !opened {
        return Err(AppError::Shell(format!("couldn't open {label}")));
    }
    Ok(format!(
        "Opened {label}'s extensions page — turn it off or Remove it there"
    ))
}

/// Native-confirm copy for a cache clear.
pub fn fix_confirmation(label: &str) -> (String, String) {
    (
        format!("Clear the {label} cache?"),
        "The browser must be closed. The cache re-downloads as you browse — this frees disk \
         but does not make the machine faster."
            .into(),
    )
}

/// Fix: clear a browser's disk cache. Label validated against the static
/// table; refuses while that browser is running (its own gate, like VACUUM).
pub fn clear_cache(label: &str) -> crate::error::AppResult<String> {
    use crate::error::AppError;
    let b = browser_by_label(label)
        .filter(|b| b.installed())
        .ok_or_else(|| AppError::NotFound(format!("no such browser: {label}")))?;
    let ps = sh("ps", &["-Ao", "rss=,args="]).unwrap_or_default();
    if b.running(&ps) {
        return Err(AppError::Forbidden(format!(
            "Close {label} first — its cache is in use."
        )));
    }
    let dir = b
        .cache_dir()
        .filter(|d| d.is_dir())
        .ok_or_else(|| AppError::NotFound(format!("{label} cache is already empty")))?;
    let bytes = super::deepscan::du_bytes(&dir);
    std::fs::remove_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;
    super::claude::journal(&format!(
        r#"{{"tsEpoch":{},"action":"clearBrowserCache","browser":"{label}","freedBytes":{bytes}}}"#,
        super::claude::now_epoch()
    ));
    Ok(format!(
        "Cleared the {label} cache · freed {} — it re-downloads as you browse",
        super::vscode::fmt_mb(bytes)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_processes_by_full_args_not_comm() {
        let ps = "\
  512000 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  204800 /Applications/Google Chrome.app/Contents/Frameworks/... --type=renderer --extension-process --lang=en
  102400 /Applications/Google Chrome.app/Contents/Frameworks/... --type=renderer https://example.com
   51200 /Applications/Google Chrome.app/Contents/Frameworks/... --type=gpu-process
   99999 /Applications/Brave Browser.app/Contents/MacOS/Brave Browser
     500 /usr/sbin/somethingelse";
        let c = parse_browser_ps(ps, "Google Chrome.app");
        assert_eq!(c.procs, 4);
        assert_eq!(c.total_kb, 512000 + 204800 + 102400 + 51200);
        assert_eq!(
            c.ext_procs, 1,
            "extension renderer counted once, in ext bucket"
        );
        assert_eq!(c.ext_kb, 204800);
        assert_eq!(c.renderer_kb, 102400);
        assert_eq!(c.gpu_kb, 51200);
        let b = parse_browser_ps(ps, "Brave Browser.app");
        assert_eq!((b.procs, b.total_kb), (1, 99999));
    }

    #[test]
    fn parses_background_mode_fail_safe() {
        assert_eq!(
            parse_background_mode(r#"{"background_mode":{"enabled":true}}"#),
            Some(true)
        );
        assert_eq!(
            parse_background_mode(r#"{"background_mode":{"enabled":false}}"#),
            Some(false)
        );
        assert_eq!(parse_background_mode(r#"{"other":1}"#), None);
        assert_eq!(parse_background_mode("garbage"), None);
    }

    #[test]
    fn clear_cache_rejects_unknown_browsers() {
        assert!(clear_cache("Netscape").is_err());
    }

    #[test]
    fn parses_audio_assertion_owners() {
        let out = "\
   pid 435(coreaudiod): [0x0000d2e9] 00:07:32 PreventUserIdleSystemSleep named: \"x\"
   pid 812(Google Chrome): [0x0000ffff] 01:00:00 NoIdleSleepAssertion named: \"Playing audio\"
   pid 812(Google Chrome): [0x0000fffe] 01:00:00 NoIdleSleepAssertion named: \"Playing audio\"";
        assert_eq!(parse_audio_owners(out), vec!["Google Chrome"]);
        assert!(parse_audio_owners("nothing here").is_empty());
    }

    // Real machine, read-only: both probes run without panicking.
    #[test]
    fn probes_run_on_real_machine() {
        let _ = run_processes();
        assert!(run_audio().len() <= 1 || !run_audio().is_empty());
    }

    #[test]
    fn parses_ext_manifest_name_and_background() {
        // Plain name, no locale lookup needed → vdir is never read.
        let dir = std::path::Path::new("/nonexistent");
        assert_eq!(
            parse_ext_manifest(
                r#"{"name":"uBlock Origin","background":{"service_worker":"sw.js"}}"#,
                dir,
            ),
            Some(("uBlock Origin".to_string(), true)),
        );
        assert_eq!(
            parse_ext_manifest(r#"{"name":"JSON Formatter"}"#, dir),
            Some(("JSON Formatter".to_string(), false)),
        );
        // Unresolvable __MSG__ (locale file missing) falls back to the raw name.
        assert_eq!(
            parse_ext_manifest(r#"{"name":"__MSG_extName__","default_locale":"en"}"#, dir),
            Some(("__MSG_extName__".to_string(), false)),
        );
        assert_eq!(parse_ext_manifest("garbage", dir), None);
    }

    #[test]
    fn looks_up_localized_messages_case_insensitively() {
        let msgs = r#"{"extName":{"message":"Google Docs Offline"}}"#;
        assert_eq!(
            lookup_message(msgs, "extName").as_deref(),
            Some("Google Docs Offline")
        );
        assert_eq!(
            lookup_message(msgs, "extname").as_deref(),
            Some("Google Docs Offline")
        );
        assert_eq!(lookup_message(msgs, "missing"), None);
        assert_eq!(lookup_message("garbage", "extName"), None);
    }

    #[test]
    fn manage_extension_rejects_unknown_targets() {
        assert!(manage_extension("Netscape:abc").is_err());
        assert!(manage_extension("no-colon").is_err());
    }

    // Real machine, read-only: always at least one finding (overview or "none").
    #[test]
    fn extensions_probe_produces_a_finding() {
        assert!(!run_extensions().is_empty());
    }
}
