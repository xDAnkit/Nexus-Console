import { useMemo } from 'react';
import { useAppSelector } from '@/shared/state/hooks';
import { useServices } from './useServices';
import { reconcile } from './reconcile';

/** The Services-tab view model: managed registry + intent × live brew data. */
export function useReconciledServices() {
  const query = useServices();
  const managed = useAppSelector((s) => s.serviceIntent.managed);
  const intent = useAppSelector((s) => s.serviceIntent.intent);

  const services = useMemo(
    () => reconcile(managed, query.data ?? [], intent),
    [managed, query.data, intent],
  );

  return { ...query, services };
}
