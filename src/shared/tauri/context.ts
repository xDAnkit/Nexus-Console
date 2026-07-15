import { useQuery } from '@tanstack/react-query';
import { ipc } from './invoke';
import { CMD } from './commands';
import { appContextSchema } from './schemas';

export const appContextQueryKey = ['app-context'] as const;

/** Machine/brew context. Discovered once by Rust at startup → never stale.
 * brewVersion resolves async in Rust (off the startup path) — poll the cheap
 * state-read until it lands, bounded so a permanently-failing probe can't
 * poll forever. */
export function useAppContext() {
  return useQuery({
    queryKey: appContextQueryKey,
    queryFn: () => ipc(CMD.GET_APP_CONTEXT, undefined, appContextSchema),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.brewBin && !query.state.data.brewVersion && query.state.dataUpdateCount < 15
        ? 1000
        : false,
  });
}
