import { RefreshCw, Search } from 'lucide-react';
import { SegmentedControl, type SegmentOption } from '@/shared/ui/SegmentedControl';
import { Button } from '@/shared/ui/Button';
import { ThemeToggle } from '@/shared/layout/ThemeToggle';
import { cn } from '@/shared/lib/cn';
import type { PortsToolbarProps } from './PortsToolbar.types';

const SCOPE: SegmentOption<'listening' | 'all'>[] = [
  { value: 'listening', label: 'Listening' },
  { value: 'all', label: 'All' },
];

export const PortsToolbar = ({
  query,
  onQueryChange,
  listeningOnly,
  onListeningChange,
  onRefresh,
  isFetching,
}: PortsToolbarProps) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <div className="relative min-w-0 flex-1 sm:flex-none">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Port, pid, or process…"
        aria-label="Search ports"
        data-nx-page-search
        className="h-9 w-full rounded-md border border-border bg-paper pr-3 pl-8 text-sm text-fg placeholder:text-fg-subtle sm:w-56"
      />
    </div>
    <ThemeToggle />
    <SegmentedControl
      ariaLabel="Scope"
      value={listeningOnly ? 'listening' : 'all'}
      options={SCOPE}
      onChange={(v) => onListeningChange(v === 'listening')}
    />
    <Button variant="secondary" size="sm" onClick={onRefresh}>
      <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
      Refresh
    </Button>
  </div>
);
