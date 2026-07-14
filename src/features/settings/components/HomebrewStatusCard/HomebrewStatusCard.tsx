import { CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAppContext } from '@/shared/tauri';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { useUpdateHomebrew } from '@/features/settings/api/useUpdateHomebrew';

export const HomebrewStatusCard = () => {
  const { data, isPending } = useAppContext();
  const update = useUpdateHomebrew();

  const detected = Boolean(data?.brewPrefix);

  return (
    <section className="rounded-xl border border-border bg-paper p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">Homebrew</h2>
        {detected && (
          <Button
            variant="secondary"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate()}
          >
            <RefreshCw className={cn('h-4 w-4', update.isPending && 'animate-spin')} />
            Update Homebrew
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="mt-3">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            {detected ? (
              <CircleCheck className="h-4 w-4 text-running" />
            ) : (
              <TriangleAlert className="h-4 w-4 text-warn" />
            )}
            <span className="text-sm text-fg">
              {detected ? `Installed · v${data?.brewVersion ?? '—'}` : 'Homebrew not detected'}
            </span>
          </div>

          {detected && (
            <dl className="mt-4 grid grid-cols-[5rem_1fr] gap-y-1.5 text-xs">
              <dt className="text-fg-muted">Prefix</dt>
              <dd className="font-mono text-fg">{data?.brewPrefix}</dd>
              <dt className="text-fg-muted">Platform</dt>
              <dd className="text-fg">
                {data?.platform} · {data?.arch}
              </dd>
            </dl>
          )}
        </>
      )}
    </section>
  );
};
