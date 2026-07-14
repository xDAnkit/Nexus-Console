import { TriangleAlert } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useUninstallFormula } from '@/shared/brew';
import { useDependents } from '@/features/packages/api/useDependents';

/** Uninstall confirm with a dependents check. Reused by Packages + Services. */
export const UninstallDialog = ({
  name,
  onClose,
}: {
  name: string | null;
  onClose: () => void;
}) => {
  const uninstall = useUninstallFormula();
  const dependents = useDependents(name);

  if (!name) return null;

  const deps = dependents.data ?? [];
  const blocked = deps.length > 0;

  const doUninstall = async (ignoreDependents: boolean) => {
    try {
      await uninstall.mutateAsync({ name, ignoreDependents });
      onClose();
    } catch {
      /* surfaced by the global error toast */
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Uninstall ${name}?`}
      description="Runs brew uninstall."
    >
      {dependents.isPending ? (
        <div className="py-2">
          <Spinner />
        </div>
      ) : blocked ? (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {deps.length} installed package{deps.length > 1 ? 's' : ''} depend on {name}.
              Uninstalling anyway may break {deps.length > 1 ? 'them' : 'it'}.
            </span>
          </div>
          <ul className="selectable mt-3 max-h-40 overflow-auto rounded-lg border border-border bg-canvas p-2 text-sm">
            {deps.map((d) => (
              <li key={d} className="px-1 py-0.5 font-mono text-fg-muted">
                {d}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Remove {name} from Homebrew.</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {blocked ? (
          <Button
            variant="danger"
            size="sm"
            disabled={uninstall.isPending}
            onClick={() => doUninstall(true)}
          >
            Uninstall anyway
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            disabled={uninstall.isPending || dependents.isPending}
            onClick={() => doUninstall(false)}
          >
            Uninstall
          </Button>
        )}
      </div>
    </Dialog>
  );
};
