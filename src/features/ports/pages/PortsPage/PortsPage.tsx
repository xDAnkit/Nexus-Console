import { useMemo, useState } from 'react';
import { Network, SearchX } from 'lucide-react';
import { usePorts } from '@/features/ports/api/usePorts';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PortsToolbar } from '@/features/ports/components/PortsToolbar';
import { PortsTable } from '@/features/ports/components/PortsTable';

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i);

const PortsTableSkeleton = () => (
  <div className="h-full overflow-hidden" aria-hidden>
    {SKELETON_ROWS.map((i) => (
      <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-list" />
        <div className="h-4 w-14 animate-pulse rounded bg-list" />
        <div className="h-4 w-12 animate-pulse rounded bg-list" />
        <div className="h-4 w-10 animate-pulse rounded bg-list" />
        <div className="h-8 w-9 animate-pulse rounded-md bg-list" />
      </div>
    ))}
  </div>
);

export const PortsPage = () => {
  const [query, setQuery] = useState('');
  const [listeningOnly, setListeningOnly] = useState(true);
  const { data, isPending, isError, error, isFetching, refetch } = usePorts(listeningOnly);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.command.toLowerCase().includes(q) ||
        String(p.port).includes(q) ||
        String(p.pid).includes(q) ||
        p.user.toLowerCase().includes(q),
    );
  }, [data, query]);

  const total = data?.length ?? 0;
  const subtitle = isPending
    ? 'Ports & processes'
    : query
      ? `${filtered.length} of ${total} shown`
      : `${total} ${listeningOnly ? 'listening' : 'active'} port${total === 1 ? '' : 's'}`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Ports</h1>
          <p className="text-sm text-fg-muted tabular-nums">{subtitle}</p>
        </div>
        <PortsToolbar
          query={query}
          onQueryChange={setQuery}
          listeningOnly={listeningOnly}
          onListeningChange={setListeningOnly}
          onRefresh={() => void refetch()}
          isFetching={isFetching}
        />
      </header>

      {/* Padded content + a bordered card frame, matching Services/Settings. */}
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-paper">
          {isPending ? (
            <PortsTableSkeleton />
          ) : isError ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                {error instanceof Error ? error.message : 'Failed to list ports'}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={query ? <SearchX className="h-8 w-8" /> : <Network className="h-8 w-8" />}
              title={
                query ? 'No matches' : listeningOnly ? 'No listening ports' : 'No active ports'
              }
              description={
                query
                  ? `Nothing matches “${query.trim()}”.`
                  : listeningOnly
                    ? 'Nothing is listening right now. Apps that open a port will show up here.'
                    : 'No processes are holding a network connection.'
              }
            />
          ) : (
            <PortsTable ports={filtered} />
          )}
        </div>
      </div>
    </div>
  );
};
