use std::collections::HashMap;

#[derive(Debug, Clone, Copy)]
pub struct PsSample {
    pub cpu: f64,
    pub rss_bytes: u64,
    pub uptime_secs: u64,
}

/// Parse `ps -o pid=,%cpu=,rss=,etime=` output. Lines like `99615 0.0 2160 05:50:48`.
/// rss is KiB; etime is `[[DD-]HH:]MM:SS`.
pub fn parse_ps(out: &str) -> HashMap<u32, PsSample> {
    let mut map = HashMap::new();
    for line in out.lines() {
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 4 {
            continue;
        }
        let (Ok(pid), Ok(cpu), Ok(rss_kib)) = (
            f[0].parse::<u32>(),
            f[1].parse::<f64>(),
            f[2].parse::<u64>(),
        ) else {
            continue;
        };
        let Some(uptime_secs) = parse_etime(f[3]) else {
            continue;
        };
        map.insert(
            pid,
            PsSample {
                cpu,
                rss_bytes: rss_kib * 1024,
                uptime_secs,
            },
        );
    }
    map
}

/// `MM:SS` | `HH:MM:SS` | `DD-HH:MM:SS` → seconds.
pub fn parse_etime(s: &str) -> Option<u64> {
    let (days, hms) = match s.split_once('-') {
        Some((d, rest)) => (d.parse::<u64>().ok()?, rest),
        None => (0, s),
    };
    let parts: Vec<&str> = hms.split(':').collect();
    let (h, m, sec): (u64, u64, u64) = match parts.as_slice() {
        [m, s] => (0, m.parse().ok()?, s.parse().ok()?),
        [h, m, s] => (h.parse().ok()?, m.parse().ok()?, s.parse().ok()?),
        _ => return None,
    };
    Some(((days * 24 + h) * 60 + m) * 60 + sec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn etime_formats() {
        assert_eq!(parse_etime("44:35"), Some(44 * 60 + 35));
        assert_eq!(parse_etime("05:50:48"), Some(5 * 3600 + 50 * 60 + 48));
        assert_eq!(
            parse_etime("01-10:32:41"),
            Some(((24 + 10) * 60 + 32) * 60 + 41)
        );
        assert_eq!(parse_etime("garbage"), None);
    }

    #[test]
    fn parses_ps_fixture() {
        let out = include_str!("../../../fixtures/ps-stats.txt");
        let m = parse_ps(out);
        let s = m.get(&99615).expect("redis stats present");
        assert_eq!(s.rss_bytes, 2160 * 1024);
        assert!(s.uptime_secs > 0);
    }
}
