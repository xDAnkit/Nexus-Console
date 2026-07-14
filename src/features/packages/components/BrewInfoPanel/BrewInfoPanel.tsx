import { X } from 'lucide-react';
import { useBrewInfo } from '@/features/packages/api/useBrewInfo';
import { Spinner } from '@/shared/ui/Spinner';

export const BrewInfoPanel = ({ name, onClose }: { name: string; onClose: () => void }) => {
  const { data, isPending } = useBrewInfo(name);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-paper">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="truncate font-mono text-sm font-semibold text-fg">{name}</h2>
        <button
          type="button"
          aria-label="Close info"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-fg-muted hover:bg-list hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="selectable min-h-0 flex-1 overflow-auto p-4">
        {isPending ? (
          <Spinner />
        ) : data ? (
          <div className="space-y-4 text-sm">
            {data.description && <p className="text-fg-muted">{data.description}</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {data.version && (
                <>
                  <dt className="text-fg-subtle">Version</dt>
                  <dd className="font-mono text-fg">{data.version}</dd>
                </>
              )}
              <dt className="text-fg-subtle">Type</dt>
              <dd className="text-fg">
                {data.isCask ? 'Cask' : 'Formula'}
                {data.isService ? ' · service' : ''}
              </dd>
            </dl>

            {data.homepage && (
              <div className="text-xs">
                <p className="mb-0.5 text-fg-subtle uppercase">Homepage</p>
                <p className="break-all text-fg-muted">{data.homepage}</p>
              </div>
            )}

            {data.dependencies.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-fg-subtle uppercase">
                  Dependencies ({data.dependencies.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.dependencies.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-list px-1.5 py-0.5 font-mono text-xs text-fg-muted"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
};
