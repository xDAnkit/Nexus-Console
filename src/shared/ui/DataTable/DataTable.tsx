import { useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { DataTableProps } from './DataTable.types';

/** Generic virtualized table: react-table (sort) + react-virtual (rows). Div-based
 * so virtualization is clean. Reused by Ports / Packages / Sessions. */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  estimateRowHeight = 44,
  emptyMessage = 'Nothing to show.',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 12,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div className="sticky top-0 z-[1] flex border-b border-border bg-canvas">
        {table.getFlatHeaders().map((h) => {
          const sorted = h.column.getIsSorted();
          const alignRight = h.column.columnDef.meta?.align === 'right';
          return (
            <button
              key={h.id}
              type="button"
              onClick={h.column.getToggleSortingHandler()}
              disabled={!h.column.getCanSort()}
              style={{ width: h.getSize(), flexGrow: h.column.columnDef.meta?.grow ? 1 : 0 }}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-xs font-medium text-fg-muted',
                'enabled:hover:text-fg disabled:cursor-default',
                alignRight ? 'justify-end text-right' : 'text-left',
              )}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
              {sorted === 'asc' && <ChevronUp className="h-3 w-3" />}
              {sorted === 'desc' && <ChevronDown className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-fg-muted">{emptyMessage}</p>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={row.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
                className="flex items-center border-b border-border hover:bg-list/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      flexGrow: cell.column.columnDef.meta?.grow ? 1 : 0,
                    }}
                    className={cn(
                      'min-w-0 px-3 py-2',
                      cell.column.columnDef.meta?.align === 'right' && 'text-right',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
