import { useQuery } from '@tanstack/react-query';
import { ipc, CMD } from '@/shared/tauri';
import { useAppSelector } from '@/shared/state/hooks';
import { env } from '@/config/env';
import { brewKeys } from './keys';
import { servicesSchema } from './schemas';

export function useEffectivePollMs(): number {
  return useAppSelector((s) => s.settings.pollIntervalMs) || env.VITE_POLL_MS_DEFAULT;
}

/** Live brew services. Polls on every tab (so the sidebar badge, session recorder,
 * and crash detection stay current), but pauses when the window is hidden/blurred
 * (focusManager + refetchIntervalInBackground:false) to stay light. */
export function useServices() {
  const pollMs = useEffectivePollMs();
  return useQuery({
    queryKey: brewKeys.services(),
    queryFn: () => ipc(CMD.LIST_SERVICES, { withStats: true }, servicesSchema),
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
