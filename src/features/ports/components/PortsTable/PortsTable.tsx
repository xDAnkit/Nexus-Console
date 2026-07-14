import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { DataTable } from '@/shared/ui/DataTable';
import { Button } from '@/shared/ui/Button';
import { formatBytes, formatPercent } from '@/shared/lib/format';
import { ProcessCell } from '@/features/ports/components/ProcessCell';
import { KillConfirmDialog } from '@/features/ports/components/KillConfirmDialog';
import type { PortDto } from '@/features/ports/api/ports.schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildColumns(onKill: (p: PortDto) => void): ColumnDef<PortDto, any>[] {
  return [
    {
      id: 'process',
      header: 'Process',
      size: 220,
      meta: { grow: true },
      accessorFn: (r) => r.command,
      cell: ({ row }) => <ProcessCell command={row.original.command} user={row.original.user} />,
    },
    {
      accessorKey: 'port',
      header: 'Port',
      size: 90,
      meta: { align: 'right' },
      cell: (c) => (
        <span className="font-medium text-fg tabular-nums">:{c.getValue<number>()}</span>
      ),
    },
    {
      accessorKey: 'pid',
      header: 'PID',
      size: 80,
      meta: { align: 'right' },
      cell: (c) => <span className="text-fg-muted tabular-nums">{c.getValue<number>()}</span>,
    },
    {
      accessorKey: 'cpu',
      header: 'CPU',
      size: 72,
      meta: { align: 'right' },
      cell: (c) => (
        <span className="text-fg-muted tabular-nums">
          {formatPercent(c.getValue<number | null>())}
        </span>
      ),
    },
    {
      accessorKey: 'memoryBytes',
      header: 'Mem',
      size: 84,
      meta: { align: 'right' },
      cell: (c) => (
        <span className="text-fg-muted tabular-nums">
          {formatBytes(c.getValue<number | null>())}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 64,
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const isSystem = row.original.pid < 2;
        return (
          <Button
            variant="dangerGhost"
            size="icon"
            disabled={isSystem}
            aria-label={`Kill ${row.original.command}`}
            title={isSystem ? 'Cannot kill a system process' : 'Kill process'}
            onClick={() => onKill(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];
}

export const PortsTable = ({ ports }: { ports: PortDto[] }) => {
  const [killTarget, setKillTarget] = useState<PortDto | null>(null);
  const columns = useMemo(() => buildColumns(setKillTarget), []);

  return (
    <>
      <DataTable
        data={ports}
        columns={columns}
        getRowId={(r) => `${r.pid}-${r.port}`}
        estimateRowHeight={52}
        emptyMessage="No listening ports found."
      />
      <KillConfirmDialog
        key={killTarget?.pid ?? 'none'}
        target={killTarget}
        onClose={() => setKillTarget(null)}
      />
    </>
  );
};
