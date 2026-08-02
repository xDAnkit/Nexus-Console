import { useMemo, useState } from 'react';
import { LayoutGrid, Play, Plus, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setCardOrder } from '@/shared/state/settingsSlice';
import { applyCardOrder, mergeVisibleOrder } from './cardOrder';
import {
  useBulkPower,
  isRunning,
  isStartable,
  summarizeBulk,
  type BulkResult,
} from './useBulkPower';
import { useReconciledServices, type ReconciledService } from '@/shared/brew';
import { useAppContext, confirmBulk } from '@/shared/tauri';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorPanel } from '@/shared/ui/ErrorPanel';
import { ServiceGrid } from '@/features/services/components/ServiceGrid';
import { ServiceList } from '@/features/services/components/ServiceList';
import { ServicesToolbar } from '@/features/services/components/ServicesToolbar';
import { ConnectServiceModal } from '@/features/services/components/ConnectServiceModal';

const MAX_NAMES = 8;
// A readable subset for the confirm message — never dump 40 names into an alert.
const nameList = (svcs: ReconciledService[]) => {
  const names = svcs.map((s) => s.displayName);
  return names.length <= MAX_NAMES
    ? names.join(', ')
    : `${names.slice(0, MAX_NAMES).join(', ')} +${names.length - MAX_NAMES} more`;
};

export const ServicesPage = () => {
  const { services, isPending, isError, error, isFetching, refetch } = useReconciledServices();
  const layout = useAppSelector((s) => s.settings.layout);
  const cardOrder = useAppSelector((s) => s.settings.cardOrder);
  const dispatch = useAppDispatch();
  const { data: ctx } = useAppContext();
  const bulk = useBulkPower();
  const [query, setQuery] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(() => applyCardOrder(services, cardOrder), [services, cardOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.formula.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const runningServices = useMemo(() => services.filter(isRunning), [services]);
  const startableServices = useMemo(() => services.filter(isStartable), [services]);
  // "Start all" only when nothing is running (everything's off); otherwise
  // "Stop all" is the relevant global action.
  const allStopped = runningServices.length === 0 && startableServices.length > 0;

  const handleReorder = (visible: string[]) =>
    dispatch(setCardOrder(mergeVisibleOrder(ordered, visible)));

  const runBulk = async (verb: string, action: () => Promise<BulkResult>) => {
    setBusy(true);
    try {
      const res = await action();
      const msg = summarizeBulk(verb, res);
      if (res.failed > 0) toast.error(msg);
      else toast.success(msg);
    } finally {
      setBusy(false);
    }
  };

  // Start is safe + reversible → no confirm. Stop all confirms natively, naming
  // the count + services affected.
  const onStartAll = () => runBulk('Started', () => bulk.startMany(startableServices));

  const onStopAll = async () => {
    const confirmed = await confirmBulk({
      title: 'Stop all services',
      message: `Stop all ${runningServices.length} running service${runningServices.length === 1 ? '' : 's'}?\n${nameList(runningServices)}`,
      action: 'Stop all',
    });
    if (confirmed) await runBulk('Stopped', () => bulk.stopMany(runningServices));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Services</h1>
          <p className="text-sm text-fg-muted">Manage your local services</p>
        </div>
        <ServicesToolbar
          query={query}
          onQueryChange={setQuery}
          onRefresh={() => void refetch()}
          isFetching={isFetching}
        />
      </header>

      <ConnectServiceModal open={connectOpen} onOpenChange={setConnectOpen} />

      {/* Persistent action toolbar (service ke andar wala header) — the global
          Start all / Stop all action + Add, always visible above the grid.
          Per-service control lives on each card's own buttons. */}
      {ctx?.brewVersion && (
        <div className="flex items-center justify-end gap-2 border-b border-border bg-paper px-6 py-2.5 text-sm">
          {runningServices.length > 0 ? (
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={busy}
              onClick={() => void onStopAll()}
            >
              <Square className="h-4 w-4" />
              Stop all
            </Button>
          ) : (
            allStopped && (
              <Button
                size="sm"
                variant="primaryOutline"
                disabled={busy}
                onClick={() => void onStartAll()}
              >
                <Play className="h-4 w-4" />
                Start all
              </Button>
            )
          )}
          {(runningServices.length > 0 || allStopped) && (
            <div aria-hidden className="h-6 w-px bg-border" />
          )}
          <Button size="sm" onClick={() => setConnectOpen(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-paper"
              />
            ))}
          </div>
        ) : /* Only when there's nothing to show. A failed background poll on top
               of a good list must not wipe the grid — the toast already reports
               it, and the next tick usually recovers. */
        isError && services.length === 0 ? (
          <ErrorPanel
            error={error}
            fallback="Failed to load services"
            onRetry={() => void refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-8 w-8" />}
            title="No services"
            description={query ? 'Nothing matches your search.' : 'Add a service to get started.'}
          />
        ) : layout === 'grid' ? (
          <ServiceGrid services={filtered} onReorder={handleReorder} />
        ) : (
          <ServiceList services={filtered} />
        )}
      </div>
    </div>
  );
};
