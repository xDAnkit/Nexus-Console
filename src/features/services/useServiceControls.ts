import { useAppDispatch } from '@/shared/state/hooks';
import { setIntent } from '@/shared/state/serviceIntentSlice';
import { markUserStop } from '@/shared/lib/userStops';
import { useStartService, useStopService, type ReconciledService } from '@/shared/brew';

/**
 * Single source of truth for the start/stop side-effects: record link intent so
 * quit-cleanup knows the launch is ours, mark a user-stop so its crash toast is
 * suppressed, then fire the (optimistic) mutation. Consumed by both the per-card
 * `ServiceActions` and the page-level bulk controls, so the two can't drift.
 *
 * `silent` opts the mutations out of the global error toast — bulk reports one
 * aggregated result instead of N per-item toasts.
 */
export function useServiceControls(opts?: { silent?: boolean }) {
  const startMut = useStartService(opts);
  const stopMut = useStopService(opts);
  const dispatch = useAppDispatch();

  const start = (service: ReconciledService) => {
    const linked = service.linkState === 'linked';
    dispatch(setIntent({ formula: service.formula, linkState: linked ? 'linked' : 'unlinked' }));
    return startMut.mutateAsync({ name: service.formula, linked });
  };

  const stop = (service: ReconciledService) => {
    markUserStop(service.formula);
    return stopMut.mutateAsync({ name: service.formula });
  };

  return { startMut, stopMut, start, stop };
}
