import { AlertCircle, RotateCw } from 'lucide-react';
import { IpcError } from '@/shared/tauri';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import type { ErrorPanelProps } from './ErrorPanel.types';

/** The one panel every page shows when a query fails, so a transient Homebrew
 * hiccup and a real failure never look the same.
 *
 * `busy` (Homebrew mid-self-upgrade — see `AppError::Busy` in Rust) is not a
 * failure: it clears itself and the poll retries in seconds. It gets a spinner
 * and a warn tone. Everything else keeps the red treatment it deserves. */
export const ErrorPanel = ({ error, fallback, onRetry }: ErrorPanelProps) => {
  const busy = error instanceof IpcError && error.kind === 'busy';
  const message = error instanceof Error ? error.message : fallback;

  if (busy) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3">
        <Spinner className="mt-0.5 shrink-0 text-warn" />
        <div className="space-y-0.5 text-sm">
          <p className="font-medium text-fg">{message}</p>
          <p className="text-fg-muted">
            Your running services are unaffected. This retries automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="break-words text-danger">{message}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
};
