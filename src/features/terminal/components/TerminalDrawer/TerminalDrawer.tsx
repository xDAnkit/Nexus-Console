import { X, TerminalSquare } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setDrawerOpen } from '@/shared/state/terminalsSlice';
import { TerminalTabs } from '@/features/terminal/components/TerminalTabs';
import { XtermView } from '@/features/terminal/components/XtermView';

export const TerminalDrawer = () => {
  const dispatch = useAppDispatch();
  const sessions = useAppSelector((s) => s.terminals.sessions);
  const activeId = useAppSelector((s) => s.terminals.activeId);
  const drawerOpen = useAppSelector((s) => s.terminals.drawerOpen);

  // Unmount only when there are no sessions. "Hide" is CSS-only — unmounting
  // XtermViews would kill their PTYs (running shells silently destroyed).
  if (sessions.length === 0) return null;

  return (
    <div
      className={cn(
        'flex h-72 shrink-0 flex-col border-t border-border bg-paper',
        !drawerOpen && 'hidden',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <TerminalSquare className="h-4 w-4 shrink-0 text-fg-muted" />
          <TerminalTabs />
        </div>
        <button
          type="button"
          aria-label="Hide terminal"
          onClick={() => dispatch(setDrawerOpen(false))}
          className="shrink-0 rounded-md p-1 text-fg-muted hover:bg-list hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* All sessions stay mounted (PTYs persist) — inactive ones hidden via visibility. */}
      <div className="relative min-h-0 flex-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="absolute inset-0 p-2"
            style={{ visibility: s.id === activeId ? 'visible' : 'hidden' }}
          >
            <XtermView session={s} active={s.id === activeId} visible={drawerOpen} />
          </div>
        ))}
      </div>
    </div>
  );
};
