/// Extract the log file (StandardOutPath) from a homebrew `homebrew.mxcl.*.plist`.
/// Minimal string scan — no XML dep. Returns None if the key isn't present.
pub fn log_path_from_plist(plist: &str) -> Option<String> {
    let at = plist.find("StandardOutPath")?;
    let after = &plist[at..];
    let start = after.find("<string>")? + "<string>".len();
    let rel = &after[start..];
    let end = rel.find("</string>")?;
    Some(rel[..end].trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_log_path() {
        let plist =
            "<key>StandardOutPath</key>\n\t<string>/opt/homebrew/var/log/redis.log</string>";
        assert_eq!(
            log_path_from_plist(plist).as_deref(),
            Some("/opt/homebrew/var/log/redis.log")
        );
    }

    #[test]
    fn none_when_absent() {
        assert!(log_path_from_plist("<key>Label</key><string>x</string>").is_none());
    }
}
