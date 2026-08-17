use crate::context::AppContext;
use crate::error::{AppError, AppResult};
use crate::util::{plist, validate};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::os::unix::io::RawFd;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::State;

const MAX_PTYS: usize = 8;
/// Cap per flushed Output event — bounds both IPC payloads and xterm write calls.
const MAX_BATCH: usize = 32 * 1024;

/// Zero-timeout poll: is more PTY output already buffered? Zero timeout means
/// coalescing never ADDS latency — a lone keystroke echo flushes immediately.
fn readable_now(fd: RawFd) -> bool {
    let mut p = libc::pollfd {
        fd,
        events: libc::POLLIN,
        revents: 0,
    };
    // SAFETY: poll(2) on one fd with zero timeout; no memory handed to the kernel
    // beyond the pollfd on our stack.
    unsafe { libc::poll(&mut p, 1, 0) > 0 && (p.revents & libc::POLLIN) != 0 }
}

/// Take the largest valid-UTF-8 prefix out of `acc`, holding back an incomplete
/// trailing codepoint for the next batch (a read can split a multi-byte char —
/// flushing the halves separately renders mojibake). Genuinely invalid bytes
/// (binary output) degrade lossily, same as before.
fn take_utf8(acc: &mut Vec<u8>) -> String {
    match std::str::from_utf8(acc.as_slice()) {
        Ok(s) => {
            let out = s.to_owned();
            acc.clear();
            out
        }
        Err(e) if e.error_len().is_none() => {
            let tail = acc.split_off(e.valid_up_to());
            let out = String::from_utf8_lossy(acc).into_owned();
            *acc = tail;
            out
        }
        Err(_) => {
            let out = String::from_utf8_lossy(acc).into_owned();
            acc.clear();
            out
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PtyEvent {
    Output { data: String },
    Exit,
}

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyManager {
    sessions: Mutex<HashMap<String, Session>>,
}

impl PtyManager {
    #[allow(clippy::too_many_arguments)]
    fn open(
        &self,
        id: String,
        program: String,
        args: Vec<String>,
        cols: u16,
        rows: u16,
        on_event: Channel<PtyEvent>,
    ) -> AppResult<()> {
        let mut map = lock(&self.sessions)?;
        if map.contains_key(&id) {
            return Ok(()); // already open — focus handled client-side
        }
        if map.len() >= MAX_PTYS {
            return Err(AppError::Forbidden(format!(
                "terminal limit ({MAX_PTYS}) reached"
            )));
        }

        let pair = native_pty_system()
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Io(format!("openpty: {e}")))?;

        let mut cmd = CommandBuilder::new(&program);
        cmd.args(&args);
        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Shell(format!("spawn {program}: {e}")))?;
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Io(format!("pty reader: {e}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Io(format!("pty writer: {e}")))?;

        // Blocking reader thread streams output to the JS Channel until EOF.
        // Coalesced: after each blocking read, whatever is ALREADY buffered is
        // drained (zero-timeout poll) up to MAX_BATCH and flushed as one event —
        // a fast producer (`yes`, big logs) floods neither IPC nor xterm, while
        // interactive echo still flushes per read with no added latency.
        let master_fd = pair.master.as_raw_fd();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            let mut acc: Vec<u8> = Vec::with_capacity(8192);
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        acc.extend_from_slice(&buf[..n]);
                        while acc.len() < MAX_BATCH && master_fd.is_some_and(readable_now) {
                            match reader.read(&mut buf) {
                                Ok(n2) if n2 > 0 => acc.extend_from_slice(&buf[..n2]),
                                _ => break,
                            }
                        }
                        let text = take_utf8(&mut acc);
                        if !text.is_empty()
                            && on_event.send(PtyEvent::Output { data: text }).is_err()
                        {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            // EOF: flush any held-back tail bytes (lossily — nothing follows them).
            if !acc.is_empty() {
                let _ = on_event.send(PtyEvent::Output {
                    data: String::from_utf8_lossy(&acc).into_owned(),
                });
            }
            let _ = on_event.send(PtyEvent::Exit);
        });

        map.insert(
            id,
            Session {
                writer,
                master: pair.master,
                child,
            },
        );
        Ok(())
    }

    fn write(&self, id: &str, data: &[u8]) -> AppResult<()> {
        let mut map = lock(&self.sessions)?;
        if let Some(s) = map.get_mut(id) {
            s.writer
                .write_all(data)
                .map_err(|e| AppError::Io(format!("pty write: {e}")))?;
            let _ = s.writer.flush();
        }
        Ok(())
    }

    fn resize(&self, id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let map = lock(&self.sessions)?;
        if let Some(s) = map.get(id) {
            let _ = s.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
        }
        Ok(())
    }

    fn kill(&self, id: &str) -> AppResult<()> {
        let mut map = lock(&self.sessions)?;
        if let Some(mut s) = map.remove(id) {
            kill_group(&mut s.child);
        }
        Ok(())
    }

    /// Kill every live PTY (called on app quit so no children are orphaned).
    pub fn kill_all(&self) {
        if let Ok(mut map) = self.sessions.lock() {
            for (_, mut s) in map.drain() {
                kill_group(&mut s.child);
            }
        }
    }
}

/// PTY children are session/group leaders, so signal the whole process group —
/// this also kills anything launched inside the shell (node, docker, …).
fn kill_group(child: &mut Box<dyn Child + Send + Sync>) {
    if let Some(pid) = child.process_id() {
        // Negative pid = process group. SAFETY: kill(2) with a constant signal.
        unsafe {
            libc::kill(-(pid as i32), libc::SIGHUP);
        }
    }
    let _ = child.kill();
}

fn lock(
    m: &Mutex<HashMap<String, Session>>,
) -> AppResult<std::sync::MutexGuard<'_, HashMap<String, Session>>> {
    m.lock()
        .map_err(|_| AppError::Io("pty lock poisoned".into()))
}

/// Server-side allowlist — JS passes a formula + kind, never a program. Resolves
/// the client binary (or a login shell) / the `tail -f` log command.
fn resolve_command(
    formula: &str,
    kind: &str,
    ctx: &AppContext,
) -> AppResult<(String, Vec<String>)> {
    validate::validate_formula(formula)?;
    // brew installs a tap formula under its bare name (opt/mongodb-community@7.0),
    // so every path and client lookup below drops the `user/repo/` prefix.
    let formula = validate::bare_formula(formula);
    let prefix = ctx.brew_prefix.as_deref().unwrap_or("/opt/homebrew");
    let base = formula.split('@').next().unwrap_or(formula);
    let bin = |name: &str| format!("{prefix}/bin/{name}");

    if kind == "logs" {
        let plist_file = format!("{prefix}/opt/{formula}/homebrew.mxcl.{formula}.plist");
        let log = std::fs::read_to_string(&plist_file)
            .ok()
            .and_then(|c| plist::log_path_from_plist(&c))
            .unwrap_or_else(|| format!("{prefix}/var/log/{base}.log"));
        return Ok(("tail".into(), vec!["-f".into(), log]));
    }

    let client = match base {
        "redis" | "valkey" => Some((bin("redis-cli"), vec![])),
        // psql defaults to a DB named after the OS user, which usually doesn't
        // exist — connect to the always-present `postgres` database instead.
        "postgresql" | "postgres" => Some((bin("psql"), vec!["-d".into(), "postgres".into()])),
        "mysql" | "mariadb" | "percona-server" => Some((bin("mysql"), vec![])),
        "mongodb" | "mongodb-community" => Some((bin("mongosh"), vec![])),
        _ => None,
    };
    match client {
        Some((path, args)) if std::path::Path::new(&path).exists() => Ok((path, args)),
        _ => {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
            Ok((shell, vec!["-l".into()]))
        }
    }
}

// All four are `async` so Tauri runs them off the main thread — a sync command
// runs ON the main thread, so an openpty/spawn or a write into a full PTY buffer
// would stall the UI (same pattern as the brew commands in commands/).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn pty_open(
    id: String,
    formula: String,
    kind: String,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
    ctx: State<'_, AppContext>,
    mgr: State<'_, PtyManager>,
) -> AppResult<()> {
    let (program, args) = resolve_command(&formula, &kind, &ctx)?;
    mgr.open(id, program, args, cols, rows, on_event)
}

#[tauri::command]
pub async fn pty_write(id: String, data: String, mgr: State<'_, PtyManager>) -> AppResult<()> {
    mgr.write(&id, data.as_bytes())
}

#[tauri::command]
pub async fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    mgr: State<'_, PtyManager>,
) -> AppResult<()> {
    mgr.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_kill(id: String, mgr: State<'_, PtyManager>) -> AppResult<()> {
    mgr.kill(&id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_utf8_holds_back_split_codepoint() {
        // "€" = E2 82 AC. First batch ends mid-char; the tail must carry over.
        let mut acc = b"ok \xE2\x82".to_vec();
        assert_eq!(take_utf8(&mut acc), "ok ");
        assert_eq!(acc, b"\xE2\x82");
        acc.extend_from_slice(b"\xAC done");
        assert_eq!(take_utf8(&mut acc), "€ done");
        assert!(acc.is_empty());
    }

    #[test]
    fn take_utf8_degrades_invalid_bytes_lossily() {
        let mut acc = b"a\xFFb".to_vec();
        assert_eq!(take_utf8(&mut acc), "a\u{FFFD}b");
        assert!(acc.is_empty());
    }

    // Proof that portable-pty spawns + streams on this machine. Ignored in CI.
    #[test]
    #[ignore]
    fn pty_spawns_and_reads() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("echo");
        cmd.arg("nexus-pty-ok");
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut buf = [0u8; 512];
        let n = reader.read(&mut buf).unwrap();
        let out = String::from_utf8_lossy(&buf[..n]).into_owned();
        let _ = child.wait();
        assert!(out.contains("nexus-pty-ok"), "got: {out:?}");
    }
}
