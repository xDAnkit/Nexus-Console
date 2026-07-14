import { X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setActiveTerminal, closeTerminal } from '@/shared/state/terminalsSlice';
import { cn } from '@/shared/lib/cn';

export const TerminalTabs = () => {
  const dispatch = useAppDispatch();
  const sessions = useAppSelector((s) => s.terminals.sessions);
  const activeId = useAppSelector((s) => s.terminals.activeId);

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {sessions.map((s) => (
        <div
          key={s.id}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs transition-colors',
            s.id === activeId ? 'bg-list text-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          <button type="button" onClick={() => dispatch(setActiveTerminal(s.id))}>
            {s.title}
          </button>
          <button
            type="button"
            aria-label={`Close ${s.title}`}
            onClick={() => dispatch(closeTerminal(s.id))}
            className="rounded p-0.5 hover:bg-border"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
