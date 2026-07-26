import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/Button';
import { useClaudeSettings, useSetRetention } from '@/features/archiver/api/useArchiver';
import { RETENTION_WARN_DAYS } from '@/features/archiver/api/archiver.schema';

/** Compact header control for Claude's `cleanupPeriodDays` — the
 * silent-deletion setting (default 30!). Editing goes through the backend's
 * parse-modify-write with a .bak backup. */
export const RetentionControl = () => {
  const { data, isPending } = useClaudeSettings();
  const setRetention = useSetRetention();
  const [draft, setDraft] = useState<string | null>(null);

  if (isPending) {
    return <div aria-hidden className="h-8 w-56 animate-pulse rounded-md bg-list" />;
  }

  const current = data?.cleanupPeriodDays;
  const value = draft ?? String(current ?? '');
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed > 0;
  const low = (draft == null ? (current ?? 30) : parsed) < RETENTION_WARN_DAYS;

  const save = async () => {
    try {
      await setRetention.mutateAsync({ days: parsed });
      setDraft(null);
      toast.success(`Chat retention set to ${parsed} days`);
    } catch {
      /* surfaced by the global error toast */
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3"
      title="Claude Code silently deletes chats older than this (its default is 30 days). Archived chats are outside its reach, but restored ones re-expire."
    >
      <div className="min-w-0">
        <label htmlFor="retention-days" className="block text-sm font-medium text-fg">
          Keep chats
        </label>
        <p className="truncate text-xs text-fg-muted">
          Claude deletes older transcripts — archived ones are safe.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {low && (
          <TriangleAlert
            className="h-4 w-4 shrink-0 text-warn"
            aria-label={`Below ${RETENTION_WARN_DAYS} days, restored chats can be silently deleted again`}
          />
        )}
        <input
          id="retention-days"
          inputMode="numeric"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 w-20 rounded-md border border-border bg-paper px-2 text-right text-sm text-fg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <span className="text-sm text-fg-muted">days</span>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!valid || draft == null || parsed === current || setRetention.isPending}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
