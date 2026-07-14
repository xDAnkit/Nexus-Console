import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/DataTable';
import { Button } from '@/shared/ui/Button';
import { OutdatedBadge } from '@/features/packages/components/OutdatedBadge';
import { PackageActions } from '@/features/packages/components/PackageActions';
import type { PackageDto } from '@/features/packages/api/packages.schema';

interface Props {
  packages: PackageDto[];
  serviceNames: Set<string>;
  onSelect: (name: string) => void;
  onUninstall: (name: string) => void;
  onUpgrade: (name: string) => void;
}

export const PackagesTable = ({
  packages,
  serviceNames,
  onSelect,
  onUninstall,
  onUpgrade,
}: Props) => {
  const columns = useMemo<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ColumnDef<PackageDto, any>[]
  >(
    () => [
      {
        id: 'name',
        header: 'Name',
        size: 260,
        meta: { grow: true },
        accessorFn: (r) => r.name,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <button
              type="button"
              onClick={() => onSelect(p.name)}
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <span className="truncate font-mono text-sm text-fg">{p.name}</span>
              <span className="shrink-0 rounded bg-list px-1.5 py-0.5 text-[10px] text-fg-subtle uppercase">
                {p.kind}
              </span>
              {p.pinned && <span className="shrink-0 text-[10px] text-fg-subtle">pinned</span>}
            </button>
          );
        },
      },
      {
        accessorKey: 'version',
        header: 'Version',
        size: 210,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs text-fg-muted">{p.version}</span>
              {p.outdated && <OutdatedBadge latestVersion={p.latestVersion} />}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 150,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {p.outdated && !p.pinned && (
                <Button variant="secondary" size="sm" onClick={() => onUpgrade(p.name)}>
                  Upgrade
                </Button>
              )}
              <PackageActions
                pkg={p}
                isServiceCapable={serviceNames.has(p.name)}
                onInfo={() => onSelect(p.name)}
                onUninstall={() => onUninstall(p.name)}
              />
            </div>
          );
        },
      },
    ],
    [serviceNames, onSelect, onUninstall, onUpgrade],
  );

  return (
    <DataTable
      data={packages}
      columns={columns}
      getRowId={(r) => r.name}
      estimateRowHeight={48}
      emptyMessage="No packages found."
    />
  );
};
