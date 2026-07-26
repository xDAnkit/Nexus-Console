import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IpcError } from '@/shared/tauri';

const describe = (e: unknown) =>
  e instanceof IpcError || e instanceof Error ? e.message : 'Something went wrong';

// Central error surface: any query/mutation failure → one toast.
// A dismissed native confirm ('cancelled') is a user decision, not an error.
const notify = (e: unknown) => {
  if (e instanceof IpcError && e.kind === 'cancelled') return;
  toast.error(describe(e));
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: notify }),
  // Bulk mutations mark themselves `meta.silent` and report one aggregated
  // toast, so skip the per-item auto-toast for those.
  mutationCache: new MutationCache({
    onError: (e, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      notify(e);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
