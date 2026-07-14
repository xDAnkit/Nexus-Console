import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { formatDuration, formatTime } from '@/shared/lib/format';
import { useLiveUptime } from '@/features/sessions/hooks/useLiveUptime';
import { iconFor } from '@/features/services/components/ServiceCard';
import type { Run } from '@/shared/state/sessionsSlice';

interface Props {
  formula: string;
  displayName: string;
  runs: Run[];
}

export const SessionCard = ({ formula, displayName, runs }: Props) => {
  const [open, setOpen] = useState(false);
  const liveUptime = useLiveUptime(formula);
  const now = Date.now();
  const totalSecs = Math.floor(
    runs.reduce((sum, r) => sum + ((r.endMs ?? now) - r.startMs), 0) / 1000,
  );
  const Icon = iconFor(formula);

  return (
    <div className="rounded-xl border border-border bg-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-list text-fg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold text-fg">{displayName}</span>
          {liveUptime !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-running-soft px-2 py-0.5 text-xs text-running">
              <Clock className="h-3 w-3" />
              up {formatDuration(liveUptime)}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-fg-muted tabular-nums">
          <div className="font-semibold text-fg">{formatDuration(totalSecs)}</div>
          <div>Total uptime</div>
        </div>
        <div className="w-10 shrink-0 text-right text-xs text-fg-muted tabular-nums">
          <div className="font-semibold text-fg">{runs.length}</div>
          <div>Runs</div>
        </div>
        {runs.length > 0 ? (
          open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
      </button>

      {open && runs.length > 0 && (
        <div className="selectable border-t border-border px-4 py-2">
          {[...runs].reverse().map((r) => (
            <div
              key={r.startMs}
              className="flex items-center justify-between py-1 text-xs text-fg-muted tabular-nums"
            >
              <span>
                {formatTime(r.startMs)} → {r.endMs ? formatTime(r.endMs) : 'now'}
              </span>
              <span>{formatDuration(Math.floor(((r.endMs ?? now) - r.startMs) / 1000))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
