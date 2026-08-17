/** Human-readable byte size. */
export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  const kb = bytes / 1024;
  if (kb < 1) return `${bytes} B`;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Compact uptime: 3d 4h · 5h 50m · 2m 15s · 8s. */
export function formatDuration(secs: number | null): string {
  if (secs == null) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** CPU percentage. */
export function formatPercent(cpu: number | null): string {
  if (cpu == null) return '—';
  return `${cpu.toFixed(1)}%`;
}

/** Human relative time: "just now" · "5h ago" · "yesterday" · "12 days ago"
 * · "3 weeks ago" · "4 months ago". Pair with an absolute `title` tooltip. */
export function formatRelative(ms: number, nowMs: number = Date.now()): string {
  const secs = Math.max(0, Math.floor((nowMs - ms) / 1000));
  const days = Math.floor(secs / 86_400);
  if (secs < 3_600) return 'just now';
  if (days === 0) return `${Math.floor(secs / 3_600)}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 61) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Timestamp → "Jul 14 at 08:05 AM". */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A formula without its tap prefix — brew's own output (services list, opt/
 * paths) is always bare. `user/repo/name@1` → `name@1`; core names unchanged. */
export function bareFormula(formula: string): string {
  return formula.slice(formula.lastIndexOf('/') + 1);
}

/** Derive a display name from a formula (no hardcoded lookup): strip the tap and
 * @version, split on - / _, title-case. redis → Redis · postgresql@18 → Postgresql. */
export function formulaDisplayName(formula: string): string {
  return bareFormula(formula)
    .split('@')[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
