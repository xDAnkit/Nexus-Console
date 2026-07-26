import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Switch } from '@/shared/ui/Switch';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import {
  setAutoArchiveCutoffDays,
  setAutoArchiveEnabled,
  setAutoVacuumEnabled,
} from '@/shared/state/settingsSlice';

const CUTOFFS = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
] as const;

/** Tray automation toggles — the Rust scheduler reads these from the same
 * settings store every few minutes, so changes apply without a restart. */
export const AutomationCard = () => {
  const dispatch = useAppDispatch();
  const archiveOn = useAppSelector((s) => s.settings.autoArchiveEnabled);
  const cutoffDays = useAppSelector((s) => s.settings.autoArchiveCutoffDays);
  const vacuumOn = useAppSelector((s) => s.settings.autoVacuumEnabled);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Auto-archive daily</p>
          <p className="truncate text-xs text-fg-muted">
            Moves chats older than the cutoff to the archive.
          </p>
        </div>
        <Switch
          ariaLabel="Auto-archive daily"
          checked={archiveOn}
          onChange={(on) => dispatch(setAutoArchiveEnabled(on))}
        />
      </div>
      {archiveOn && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">Older than</p>
          <SegmentedControl
            ariaLabel="Auto-archive cutoff"
            value={String(cutoffDays)}
            options={[...CUTOFFS]}
            onChange={(v) => dispatch(setAutoArchiveCutoffDays(Number(v)))}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Auto-VACUUM VSCode</p>
          <p className="truncate text-xs text-fg-muted">
            Compacts bloated databases whenever VSCode is closed.
          </p>
        </div>
        <Switch
          ariaLabel="Auto-VACUUM VSCode"
          checked={vacuumOn}
          onChange={(on) => dispatch(setAutoVacuumEnabled(on))}
        />
      </div>
    </div>
  );
};
