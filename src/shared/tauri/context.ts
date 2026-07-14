import { useQuery } from '@tanstack/react-query';
import { ipc } from './invoke';
import { CMD } from './commands';
import { appContextSchema } from './schemas';

export const appContextQueryKey = ['app-context'] as const;

/** Machine/brew context. Discovered once by Rust at startup → never stale. */
export function useAppContext() {
  return useQuery({
    queryKey: appContextQueryKey,
    queryFn: () => ipc(CMD.GET_APP_CONTEXT, undefined, appContextSchema),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
