import { useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { ServiceCard } from '@/features/services/components/ServiceCard';
import type { ReconciledService } from '@/shared/brew';

interface ServiceGridProps {
  services: ReconciledService[];
  /** Called on drop with the new order (by formula). */
  onReorder: (formulas: string[]) => void;
}

export const ServiceGrid = ({ services, onReorder }: ServiceGridProps) => {
  // Commit on drop (not live) — reordering the dragged node mid-drag cancels the
  // native drag in the webview, which is why cards were snapping back.
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
    const next = services.map((s) => s.formula);
    next.splice(to, 0, next.splice(i, 1)[0]);
    onReorder(next);
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {services.map((s, i) => (
        <div
          key={s.formula}
          draggable
          onDragStart={() => {
            from.current = i;
            setDragId(s.formula);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (overId !== s.formula) setOverId(s.formula);
          }}
          onDrop={() => drop(i)}
          onDragEnd={reset}
          className={cn(
            'h-full cursor-grab rounded-xl transition active:cursor-grabbing',
            dragId === s.formula && 'opacity-40',
            overId === s.formula && dragId !== s.formula && 'ring-2 ring-accent',
          )}
        >
          <ServiceCard service={s} />
        </div>
      ))}
    </div>
  );
};
