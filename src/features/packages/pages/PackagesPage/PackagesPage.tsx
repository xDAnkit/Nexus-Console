import { useMemo, useState } from 'react';
import { usePackages, usePackagesOutdated } from '@/features/packages/api/usePackages';
import { useUpgradePackage, useUpgradeAll } from '@/features/packages/api/packageMutations';
import { useServices } from '@/shared/brew';
import { Spinner } from '@/shared/ui/Spinner';
import {
  PackagesToolbar,
  type PackageFilter,
} from '@/features/packages/components/PackagesToolbar';
import { PackagesTable } from '@/features/packages/components/PackagesTable';
import { BrewInfoPanel } from '@/features/packages/components/BrewInfoPanel';
import { UninstallDialog } from '@/features/packages/components/UninstallDialog';

export const PackagesPage = () => {
  const { data, isPending, isError, error, isFetching, refetch } = usePackages();
  const { data: outdated } = usePackagesOutdated();
  const { data: services } = useServices();
  const upgrade = useUpgradePackage();
  const upgradeAll = useUpgradeAll();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PackageFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);

  const serviceNames = useMemo(() => new Set((services ?? []).map((s) => s.name)), [services]);

  // Merge the (background) outdated status onto the installed list. Until it
  // resolves, packages simply show as up-to-date — the list still renders.
  const packages = useMemo(() => {
    if (!data) return [];
    const byName = new Map((outdated ?? []).map((o) => [o.name, o]));
    return data.map((p) => {
      const o = byName.get(p.name);
      return o ? { ...p, outdated: true, latestVersion: o.latestVersion, pinned: o.pinned } : p;
    });
  }, [data, outdated]);

  const upgradingName = upgrade.isPending ? upgrade.variables?.name : undefined;

  const outdatedCount = useMemo(
    () => packages.filter((p) => p.outdated && !p.pinned).length,
    [packages],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter((p) => {
      if (filter === 'formula' && p.kind !== 'formula') return false;
      if (filter === 'cask' && p.kind !== 'cask') return false;
      if (filter === 'outdated' && !p.outdated) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [packages, query, filter]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Packages</h1>
          <p className="text-sm text-fg-muted">Everything Homebrew installed</p>
        </div>
        <PackagesToolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          outdatedCount={outdatedCount}
          onUpgradeAll={() => upgradeAll.mutate()}
          isUpgradingAll={upgradeAll.isPending}
          onRefresh={() => void refetch()}
          isFetching={isFetching}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {isPending ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="m-6 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              {error instanceof Error ? error.message : 'Failed to list packages'}
            </div>
          ) : (
            <PackagesTable
              packages={filtered}
              serviceNames={serviceNames}
              onSelect={setSelected}
              onUninstall={setUninstallTarget}
              onUpgrade={(name) => upgrade.mutate({ name })}
              upgradingName={upgradingName}
            />
          )}
        </div>
        {selected && <BrewInfoPanel name={selected} onClose={() => setSelected(null)} />}
      </div>

      <UninstallDialog
        key={uninstallTarget ?? 'none'}
        name={uninstallTarget}
        onClose={() => setUninstallTarget(null)}
      />
    </div>
  );
};
