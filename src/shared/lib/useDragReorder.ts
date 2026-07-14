import { useRef, useState, type DragEvent } from 'react';

/**
 * Drag-to-reorder for a list. Commits on drop (not live) — reordering the
 * dragged node mid-drag cancels the native drag in the webview. Pass the current
 * ids in display order + an onReorder callback; spread `getItemProps(i, id)` on
 * each item and style with `dragId` / `overId`.
 */
export function useDragReorder(ids: string[], onReorder: (next: string[]) => void) {
  const from = useRef<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const reset = () => {
    from.current = null;
    setDragId(null);
    setOverId(null);
  };

  const drop = (to: number) => {
    const i = from.current;
    reset();
    if (i === null || i === to) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(i, 1)[0]);
    onReorder(next);
  };

  const getItemProps = (index: number, id: string) => ({
    draggable: true,
    onDragStart: () => {
      from.current = index;
      setDragId(id);
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (overId !== id) setOverId(id);
    },
    onDrop: () => drop(index),
    onDragEnd: reset,
  });

  return { dragId, overId, getItemProps };
}
