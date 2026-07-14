import { useMemo, useState } from 'react';
import { CircleCheck, LayoutGrid, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setCardOrder } from '@/shared/state/settingsSlice';
import { applyCardOrder, mergeVisibleOrder } from './cardOrder';
import { useReconciledServices } from '@/shared/brew';
import { useAppContext } from '@/shared/tauri';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ServiceGrid } from '@/features/services/components/ServiceGrid';
import { ServiceList } from '@/features/services/components/ServiceList';
import { ServicesToolbar } from '@/features/services/components/ServicesToolbar';
import { ConnectServiceModal } from '@/features/services/components/ConnectServiceModal';

export const ServicesPage = () => {
  const { services, isPending, isError, error, isFetching, refetch } = useReconciledServices();
  const layout = useAppSelector((s) => s.settings.layout);
  const cardOrder = useAppSelector((s) => s.settings.cardOrder);
  const dispatch = useAppDispatch();
  const { data: ctx } = useAppContext();
  const [query, setQuery] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);

  const ordered = useMemo(() => applyCardOrder(services, cardOrder), [services, cardOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.formula.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const handleReorder = (visible: string[]) =>
    dispatch(setCardOrder(mergeVisibleOrder(ordered, visible)));

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

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {ctx?.brewVersion && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-paper px-4 py-2.5 text-sm">
            <CircleCheck className="h-4 w-4 text-running" />
            <span className="text-fg-muted">
              Homebrew ready · <span className="text-fg">v{ctx.brewVersion}</span>
            </span>
            <Button size="sm" className="ml-auto" onClick={() => setConnectOpen(true)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}

        {isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-paper"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error instanceof Error ? error.message : 'Failed to load services'}
          </div>
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
