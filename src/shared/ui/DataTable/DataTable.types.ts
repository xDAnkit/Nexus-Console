import type { ColumnDef, RowData } from '@tanstack/react-table';

export interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  getRowId?: (row: T, index: number) => string;
  estimateRowHeight?: number;
  emptyMessage?: string;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Let this column flex-grow to fill remaining width. */
    grow?: boolean;
    /** Cell + header alignment. Numeric columns should be `'right'`. */
    align?: 'left' | 'right';
  }
}
