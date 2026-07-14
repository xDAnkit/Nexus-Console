import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { addManaged } from '@/shared/state/serviceIntentSlice';
import { formulaDisplayName } from '@/shared/lib/format';
import { useSearchFormulae } from '@/shared/brew';
import { Dialog } from '@/shared/ui/Dialog';
import { Spinner } from '@/shared/ui/Spinner';
import { POPULAR_FORMULAE } from './ConnectServiceModal.config';
import type { ConnectServiceModalProps } from './ConnectServiceModal.types';

export const ConnectServiceModal = ({ open, onOpenChange }: ConnectServiceModalProps) => {
  const dispatch = useAppDispatch();
  const managed = useAppSelector((s) => s.serviceIntent.managed);
  const [query, setQuery] = useState('');
  const search = useSearchFormulae(query);

  const isAdded = (formula: string) => managed.some((m) => m.formula === formula);
  const add = (formula: string) =>
    dispatch(addManaged({ formula, displayName: formulaDisplayName(formula) }));

  const showResults = query.trim().length >= 2;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Connect a service"
      description="Only formulae Homebrew can run as a service can be added."
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Homebrew formulae (e.g. mysql)…"
        aria-label="Search formulae"
        className="mb-3 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-fg placeholder:text-fg-subtle"
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {showResults ? (
          search.isPending ? (
            <div className="p-2">
              <Spinner />
            </div>
          ) : (search.data ?? []).length === 0 ? (
            <p className="px-1 py-2 text-sm text-fg-muted">No formulae found.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {(search.data ?? []).slice(0, 40).map((formula) => (
                <li key={formula}>
                  <button
                    type="button"
                    disabled={isAdded(formula)}
                    onClick={() => add(formula)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-list disabled:opacity-50"
                  >
                    <span className="font-mono text-fg">{formula}</span>
                    {isAdded(formula) ? (
                      <span className="flex items-center gap-1 text-xs text-fg-subtle">
                        <Check className="h-3.5 w-3.5" /> added
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 text-fg-muted" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <p className="mb-2 text-xs font-medium text-fg-subtle uppercase">Popular services</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_FORMULAE.map((formula) => (
                <button
                  key={formula}
                  type="button"
                  disabled={isAdded(formula)}
                  onClick={() => add(formula)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2.5 py-1.5 font-mono text-sm text-fg hover:bg-list disabled:opacity-50"
                >
                  {isAdded(formula) ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {formula}
                  {isAdded(formula) && <span className="text-xs text-fg-subtle">· added</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
