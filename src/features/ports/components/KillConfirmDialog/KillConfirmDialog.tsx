import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { IpcError } from '@/shared/tauri';
import { useKillProcess } from '@/features/ports/api/useKillProcess';
import type { PortDto } from '@/features/ports/api/ports.schema';

export const KillConfirmDialog = ({
  target,
  onClose,
}: {
  target: PortDto | null;
  onClose: () => void;
}) => {
  const kill = useKillProcess();
  const [needsAdmin, setNeedsAdmin] = useState(false);

  if (!target) return null;

  const close = () => {
    setNeedsAdmin(false);
    onClose();
  };

  const doKill = async (force: boolean, sudo: boolean) => {
    try {
      await kill.mutateAsync({ pid: target.pid, force, sudo });
      close();
    } catch (e) {
      // Permission denied → offer the native admin prompt.
      if (e instanceof IpcError && e.kind === 'forbidden' && !sudo) setNeedsAdmin(true);
    }
  };

  const systemOwned = target.user === 'root';

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={`Kill ${target.command}?`}
      description={`PID ${target.pid} · port :${target.port} · ${target.user}`}
    >
      {(systemOwned || needsAdmin) && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {needsAdmin
              ? 'Permission denied — this process needs administrator privileges to kill.'
              : 'System-owned process. Killing it may destabilize macOS.'}
          </span>
        </div>
      )}
      <p className="text-sm text-fg-muted">
        Stop the process listening on port <span className="tabular-nums">:{target.port}</span>.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={close}>
          Cancel
        </Button>
        {needsAdmin ? (
          <Button
            variant="danger"
            size="sm"
            disabled={kill.isPending}
            onClick={() => doKill(false, true)}
          >
            Kill with admin…
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={kill.isPending}
              onClick={() => doKill(true, false)}
            >
              Force
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={kill.isPending}
              onClick={() => doKill(false, false)}
            >
              Kill
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
};
