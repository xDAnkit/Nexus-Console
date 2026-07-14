import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IpcError } from '@/shared/tauri';

const describe = (e: unknown) =>
  e instanceof IpcError || e instanceof Error ? e.message : 'Something went wrong';

// Central error surface: any query/mutation failure → one toast.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(describe(e)) }),
  mutationCache: new MutationCache({ onError: (e) => toast.error(describe(e)) }),
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
