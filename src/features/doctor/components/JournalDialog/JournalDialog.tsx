import { Dialog } from '@/shared/ui/Dialog';
import { formatTime } from '@/shared/lib/format';
import { useJournal } from '@/features/doctor/api/useJournal';

/** journal action ids → readable labels; unknown ids show as-is (honesty
 * beats hiding an entry the backend logged). */
const ACTION_LABEL: Record<string, string> = {
  archive: 'Archived chats',
  restore: 'Restored chats',
  delete: 'Deleted archived chats',
  setRetention: 'Changed retention',
  vscodeCleanupOrphans: 'Deleted orphan VSCode caches',
  vscodeVacuum: 'VACUUMed state databases',
  deleteNodeModules: 'Deleted node_modules',
  clearCache: 'Cleared dev cache',
};

/** Every change the app has ever made, straight from journal.jsonl. */
export const JournalDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data, isPending } = useJournal(open);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="History"
      description="Every change this app has made — nothing mutates without a journal entry."
    >
      {isPending ? (
        <div aria-hidden className="space-y-3 py-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-list" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fg-muted">No changes yet — scans are read-only.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {data.map((e, i) => (
            <li key={`${e.tsEpoch}-${i}`} className="flex items-baseline gap-3 py-2">
              <span className="w-32 shrink-0 text-xs text-fg-subtle tabular-nums">
                {formatTime(e.tsEpoch * 1000)}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-fg">{ACTION_LABEL[e.action] ?? e.action}</p>
                {e.detail && <p className="truncate text-xs text-fg-muted">{e.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
};
