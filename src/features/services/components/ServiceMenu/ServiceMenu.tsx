import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, RotateCw, Package, Check, Trash2, ListX } from 'lucide-react';
import { useFormulaVersions, useRestartService, useInstallFormula } from '@/shared/brew';
import { useAppDispatch } from '@/shared/state/hooks';
import { removeManaged, renameManaged } from '@/shared/state/serviceIntentSlice';
import { markUserStop } from '@/shared/lib/userStops';
import { bareFormula } from '@/shared/lib/format';
import { Spinner } from '@/shared/ui/Spinner';
// Deep import — the packages barrel re-exports PackagesPage and would chain the
// whole packages chunk into the default services tab.
import { UninstallDialog } from '@/features/packages/components/UninstallDialog';
import type { ReconciledService } from '@/shared/brew';

const itemCls =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-list data-[disabled]:pointer-events-none data-[disabled]:opacity-100';
const labelCls = 'px-2.5 pt-2 pb-1 text-xs font-medium tracking-wide text-fg-subtle uppercase';

export const ServiceMenu = ({ service }: { service: ReconciledService }) => {
  const [open, setOpen] = useState(false);
  // Warm the versions query on hover so the list is ready by the time it opens.
  const [prime, setPrime] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const dispatch = useAppDispatch();
  const restart = useRestartService();
  const install = useInstallFormula();

  const installed = service.status !== 'notInstalled';
  const isRunning = service.status === 'running' || service.status === 'starting';
  const linked = service.linkState === 'linked';
  const base = bareFormula(service.formula).split('@')[0];
  const versions = useFormulaVersions(base, open || prime);

  const versionList = versions.data ?? (installed ? [service.formula] : []);

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            onPointerEnter={() => setPrime(true)}
            className="shrink-0 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-list hover:text-fg"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="nx-pop z-[var(--z-dropdown)] min-w-60 rounded-lg border border-border bg-paper p-1 shadow-md"
          >
            {isRunning && (
              <DropdownMenu.Item
                className={`${itemCls} text-fg`}
                onSelect={() => {
                  markUserStop(service.formula);
                  restart.mutate({ name: service.formula, linked });
                }}
              >
                <RotateCw className="h-4 w-4" />
                Restart
              </DropdownMenu.Item>
            )}

            <div className={labelCls}>Install / switch version</div>
            {versions.isPending ? (
              <div className="px-2.5 py-1.5">
                <Spinner />
              </div>
            ) : versionList.length === 0 ? (
              <div className="px-2.5 py-1.5 text-sm text-fg-muted">No versions found.</div>
            ) : (
              versionList.map((v) => {
                const current = installed && v === service.formula;
                return (
                  <DropdownMenu.Item
                    key={v}
                    disabled={current}
                    className={`${itemCls} text-fg`}
                    onSelect={() =>
                      install.mutate(
                        { name: v },
                        // Follow the card to whatever actually got installed.
                        {
                          onSuccess: () =>
                            dispatch(renameManaged({ from: service.formula, to: v })),
                        },
                      )
                    }
                  >
                    <Package className="h-4 w-4 text-fg-muted" />
                    <span className="font-mono">{v}</span>
                    {current && <Check className="ml-auto h-4 w-4 text-accent" />}
                  </DropdownMenu.Item>
                );
              })
            )}
            {/* Homebrew only ships @version formulae where its maintainers made
                them (redis@6.2, postgresql@18) — nginx and most others have
                exactly one. Say that, instead of leaving a lone row that reads
                like the list failed to load. */}
            {versions.data?.length === 1 && (
              <p className="px-2.5 pt-0.5 pb-1 text-xs text-fg-subtle">
                Homebrew has no other version of this formula.
              </p>
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              className={`${itemCls} text-fg`}
              onSelect={() => dispatch(removeManaged(service.formula))}
            >
              <ListX className="h-4 w-4 text-fg-muted" />
              Remove from list
            </DropdownMenu.Item>
            {installed && (
              <DropdownMenu.Item
                className={`${itemCls} text-danger`}
                onSelect={() => setUninstallOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Uninstall {base}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {uninstallOpen && (
        <UninstallDialog name={service.formula} onClose={() => setUninstallOpen(false)} />
      )}
    </>
  );
};
