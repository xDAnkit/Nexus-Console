use std::collections::HashMap;

/// Parse `lsof -nP -iTCP -sTCP:LISTEN -a -p <pids>` → pid → first listening port
/// (the REAL port, not a guessed default). Columns:
///   `COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME`
/// where NAME is `127.0.0.1:6379` or `[::1]:6379` (port after the last ':').
pub fn parse_listening_ports(out: &str) -> HashMap<u32, u16> {
    let mut map = HashMap::new();
    for line in out.lines() {
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 9 {
            continue;
        }
        let Ok(pid) = f[1].parse::<u32>() else {
            continue; // header / malformed
        };
        if let Some(port) = f[8].rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
            map.entry(pid).or_insert(port); // dedupe IPv4/IPv6 rows
        }
    }
    map
}

/// One listening socket from `lsof -F` field mode.
#[derive(Debug, Clone)]
pub struct LsofRow {
    pub pid: u32,
    pub command: String,
    pub user: String,
    pub proto: String,
    pub port: u16,
}

/// Parse `lsof -nP -iTCP -FpcLtn` (field mode). Each line is `<tag><value>`:
/// p=pid, c=command (full, spaces ok), L=user, t=type (IPv4/IPv6), n=addr:port.
/// Robust against spaced process names and IPv6 — one row per `n` line.
pub fn parse_lsof_fields(out: &str) -> Vec<LsofRow> {
    let mut rows = Vec::new();
    let mut pid = 0u32;
    let mut command = String::new();
    let mut user = String::new();
    let mut proto = String::new();

    for line in out.lines() {
        let mut chars = line.chars();
        let Some(tag) = chars.next() else { continue };
        let val = chars.as_str();
        match tag {
            'p' => pid = val.parse().unwrap_or(0),
            'c' => command = val.to_string(),
            'L' => user = val.to_string(),
            't' => proto = val.to_string(),
            'n' => {
                if let Some(port) = val.rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
                    rows.push(LsofRow {
                        pid,
                        command: command.clone(),
                        user: user.clone(),
                        proto: proto.clone(),
                        port,
                    });
                }
            }
            _ => {}
        }
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_field_mode_fixture() {
        let rows = parse_lsof_fields(include_str!("../../../fixtures/lsof-fields.txt"));
        // ControlCenter (pid 620) listens on *:7000 and *:5000
        assert!(rows
            .iter()
            .any(|r| r.pid == 620 && r.port == 7000 && r.command == "ControlCenter"));
        assert!(rows.iter().any(|r| r.pid == 620 && r.port == 5000));
    }

    #[test]
    fn field_mode_handles_spaces_and_wildcard() {
        let out = "p42\ncGoogle Chrome\nLme\ntIPv4\nn*:8080";
        let rows = parse_lsof_fields(out);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].command, "Google Chrome");
        assert_eq!(rows[0].port, 8080);
    }

    #[test]
    fn parses_lsof_fixture() {
        let m = parse_listening_ports(include_str!("../../../fixtures/lsof-listen.txt"));
        assert_eq!(m.get(&99615), Some(&6379)); // redis
        assert_eq!(m.get(&44734), Some(&5432)); // postgres
    }

    #[test]
    fn handles_ipv6_and_header() {
        let out = "COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n\
                   redis 42 me 6u IPv6 0x0 0t0 TCP [::1]:6379 (LISTEN)";
        assert_eq!(parse_listening_ports(out).get(&42), Some(&6379));
    }
}
