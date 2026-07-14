import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { seedManaged } from '@/shared/state/serviceIntentSlice';
import { formulaDisplayName } from '@/shared/lib/format';
import { useServices } from './useServices';

/** First run (per machine): seed the managed list from the brew services that
 * actually exist here — no hardcoded defaults. Runs once, after intent hydrates. */
export function useSeedManagedServices(): void {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.serviceIntent.hydrated);
  const seeded = useAppSelector((s) => s.serviceIntent.seeded);
  const { data } = useServices();

  useEffect(() => {
    if (hydrated && !seeded && data && data.length > 0) {
      dispatch(
        seedManaged(
          data.map((d) => ({ formula: d.name, displayName: formulaDisplayName(d.name) })),
        ),
      );
    }
  }, [hydrated, seeded, data, dispatch]);
}
