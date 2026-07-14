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

/** Timestamp → "Jul 14 at 08:05 AM". */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Derive a display name from a formula (no hardcoded lookup): strip @version,
 * split on - / _, title-case. redis → Redis · postgresql@18 → Postgresql. */
export function formulaDisplayName(formula: string): string {
  return formula
    .split('@')[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
