import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { removeManaged } from '@/shared/state/serviceIntentSlice';
import { Button } from '@/shared/ui/Button';
import { ConnectServiceModal, iconFor } from '@/features/services';

export const ManagedServicesEditor = () => {
  const managed = useAppSelector((s) => s.serviceIntent.managed);
  const dispatch = useAppDispatch();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-paper p-5 xl:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Managed services</h2>
          <p className="text-xs text-fg-muted">
            Services Nexus keeps in view, even when they&apos;re stopped.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add service
        </Button>
      </div>

      {managed.length === 0 ? (
        <p className="mt-4 rounded-lg bg-list px-4 py-8 text-center text-sm text-fg-muted">
          No managed services yet. Add one to pin it here.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {managed.map((m) => {
            const Icon = iconFor(m.formula);
            return (
              <li
                key={m.formula}
                className="flex items-center gap-3 rounded-lg bg-list px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-fg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{m.displayName}</p>
                  <p className="truncate font-mono text-xs text-fg-muted">{m.formula}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${m.displayName}`}
                  onClick={() => dispatch(removeManaged(m.formula))}
                  className="shrink-0 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConnectServiceModal open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
};
