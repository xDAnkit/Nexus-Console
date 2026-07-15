import { RefreshCw, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setLayout, type Layout } from '@/shared/state/settingsSlice';
import { SegmentedControl, type SegmentOption } from '@/shared/ui/SegmentedControl';
import { Button } from '@/shared/ui/Button';
import { ThemeToggle } from '@/shared/layout/ThemeToggle';
import { cn } from '@/shared/lib/cn';
import type { ServicesToolbarProps } from './ServicesToolbar.types';

const LAYOUT_OPTIONS: SegmentOption<Layout>[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
];

export const ServicesToolbar = ({
  query,
  onQueryChange,
  onRefresh,
  isFetching,
}: ServicesToolbarProps) => {
  const dispatch = useAppDispatch();
  const layout = useAppSelector((s) => s.settings.layout);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          aria-label="Search services"
          data-nx-page-search
          className="h-9 w-full rounded-md border border-border bg-paper pr-3 pl-8 text-sm text-fg placeholder:text-fg-subtle sm:w-44"
        />
      </div>
      <ThemeToggle />
      <SegmentedControl
        ariaLabel="Layout"
        value={layout}
        options={LAYOUT_OPTIONS}
        onChange={(v) => dispatch(setLayout(v))}
      />
      <Button variant="secondary" size="sm" onClick={onRefresh}>
        <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );
};
