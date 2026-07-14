import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcVoid, CMD } from '@/shared/tauri';
import { useAppDispatch } from '@/shared/state/hooks';
import { removeManaged } from '@/shared/state/serviceIntentSlice';
import { brewKeys } from './keys';
import type { ServiceDto } from './schemas';

type OptimisticPatch = Partial<Pick<ServiceDto, 'status' | 'healthy'>>;

/** Shared optimistic-update machinery: flip the service's status instantly,
 * roll back on error, reconcile with reality on settle. Errors auto-toast via
 * the global MutationCache. */
function useServiceMutation<V extends { name: string }>(
  mutationFn: (vars: V) => Promise<void>,
  optimistic?: OptimisticPatch,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: brewKeys.services() });
      const prev = qc.getQueryData<ServiceDto[]>(brewKeys.services());
      if (optimistic) {
        qc.setQueryData<ServiceDto[]>(brewKeys.services(), (old) =>
          old?.map((s) => (s.name === vars.name ? { ...s, ...optimistic } : s)),
        );
      }
      return { prev };
    },
    onError: (_e, _vars, context) => {
      if (context?.prev) qc.setQueryData(brewKeys.services(), context.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: brewKeys.services() }),
  });
}

// Start → 'started' + healthy:false so reconcile maps to 'starting' (the loader
// state), NOT straight to 'running'. The next poll's real health (a bound
// listening port) flips it to 'running' and ends the loader.
export function useStartService() {
  return useServiceMutation<{ name: string; linked: boolean }>(
    (v) => ipcVoid(CMD.START_SERVICE, v),
    {
      status: 'started',
      healthy: false,
    },
  );
}

export function useStopService() {
  return useServiceMutation<{ name: string }>((v) => ipcVoid(CMD.STOP_SERVICE, v), {
    status: 'stopped',
    healthy: null,
  });
}

export function useRestartService() {
  return useServiceMutation<{ name: string; linked: boolean }>(
    (v) => ipcVoid(CMD.RESTART_SERVICE, v),
    { status: 'started', healthy: false },
  );
}

export function useSetLinkIntent() {
  return useServiceMutation<{ name: string; linked: boolean }>((v) =>
    ipcVoid(CMD.SET_LINK_INTENT, v),
  );
}

export function useInstallFormula() {
  return useServiceMutation<{ name: string }>((v) => ipcVoid(CMD.INSTALL_FORMULA, v));
}

/** Uninstall a formula. Refreshes both services and packages. */
export function useUninstallFormula() {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: ({ name, ignoreDependents }: { name: string; ignoreDependents: boolean }) =>
      ipcVoid(CMD.UNINSTALL_FORMULA, { name, ignoreDependents }),
    onSuccess: (_data, { name }) => dispatch(removeManaged(name)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: brewKeys.services() });
      void qc.invalidateQueries({ queryKey: ['packages'] });
    },
  });
}
