import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { clearAllSessions } from '@/shared/state/sessionsSlice';
import { setCardOrder } from '@/shared/state/settingsSlice';
import { useReconciledServices } from '@/shared/brew';
import { applyCardOrder } from '@/features/services';
import { useDragReorder } from '@/shared/lib/useDragReorder';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SessionCard } from '@/features/sessions/components/SessionCard';

export const SessionsPage = () => {
  const { services } = useReconciledServices();
  const runs = useAppSelector((s) => s.sessions.runs);
  const cardOrder = useAppSelector((s) => s.settings.cardOrder);
  const dispatch = useAppDispatch();
  const hasRuns = Object.values(runs).some((r) => r.length > 0);

  // Shares the dashboard's card order — reordering here reflects there and back.
  const ordered = useMemo(() => applyCardOrder(services, cardOrder), [services, cardOrder]);
  const { dragId, overId, getItemProps } = useDragReorder(
    ordered.map((s) => s.formula),
    (next) => dispatch(setCardOrder(next)),
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Sessions</h1>
          <p className="text-sm text-fg-muted">How long each service has run</p>
        </div>
        {hasRuns && (
          <Button variant="secondary" size="sm" onClick={() => dispatch(clearAllSessions())}>
            Clear all
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-6">
        <p className="text-xs text-fg-subtle">
          Run history is recorded while Nexus Console is open. The current run&apos;s uptime is read
          from the live process.
          {ordered.length > 1 && ' Drag a card to reorder.'}
        </p>
        {ordered.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title="No services"
            description="Add a service to start tracking sessions."
          />
        ) : (
          ordered.map((s, i) => (
            <div
              key={s.formula}
              {...getItemProps(i, s.formula)}
              className={cn(
                'cursor-grab rounded-xl transition active:cursor-grabbing',
                dragId === s.formula && 'opacity-40',
                overId === s.formula && dragId !== s.formula && 'ring-2 ring-accent',
              )}
            >
              <SessionCard
                formula={s.formula}
                displayName={s.displayName}
                runs={runs[s.formula] ?? []}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
