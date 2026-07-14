use std::collections::HashMap;

/// Parse `launchctl list` → formula name → pid, for `homebrew.mxcl.*` labels with
/// a numeric PID. Rows: `PID<ws>Status<ws>Label`, e.g. `99615 0 homebrew.mxcl.redis`.
/// (split_whitespace tolerates tab or space columns and skips the header / `-` rows.)
pub fn parse_launchctl(out: &str) -> HashMap<String, u32> {
    let mut map = HashMap::new();
    for line in out.lines() {
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 3 {
            continue;
        }
        let Ok(pid) = f[0].parse::<u32>() else {
            continue;
        };
        if let Some(name) = f[2].strip_prefix("homebrew.mxcl.") {
            map.insert(name.to_string(), pid);
        }
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_launchctl_fixture() {
        let m = parse_launchctl(include_str!("../../../fixtures/launchctl-list.txt"));
        assert_eq!(m.get("redis"), Some(&99615));
        assert_eq!(m.get("postgresql@18"), Some(&44734));
    }

    #[test]
    fn skips_header_and_non_numeric() {
        let m = parse_launchctl(
            "PID\tStatus\tLabel\n-\t0\thomebrew.mxcl.stopped\n42\t0\thomebrew.mxcl.up",
        );
        assert_eq!(m.get("up"), Some(&42));
        assert!(!m.contains_key("stopped"));
    }
}
