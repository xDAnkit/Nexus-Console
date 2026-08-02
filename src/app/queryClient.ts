import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IpcError } from '@/shared/tauri';

// Types the two `meta` flags the app actually uses, so neither the toast
// suppression below nor the ActivityBar has to cast `unknown`.
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Opt out of the per-item error toast (bulk ops toast once, aggregated). */
      silent?: boolean;
      /** Verb shown in the ActivityBar while this runs, e.g. 'Starting'. */
      label?: string;
    };
  }
}

const describe = (e: unknown) =>
  e instanceof IpcError || e instanceof Error ? e.message : 'Something went wrong';

// Central error surface: any query/mutation failure → one toast.
// A dismissed native confirm ('cancelled') is a user decision, not an error.
// 'busy' is Homebrew mid-self-upgrade — transient, self-clearing, and nothing
// to act on, so it gets a calm info toast rather than an alarming red one.
const notify = (e: unknown) => {
  if (e instanceof IpcError && e.kind === 'cancelled') return;
  if (e instanceof IpcError && e.kind === 'busy') {
    // Fixed id: the 4s poll would otherwise stack one toast per tick for the
    // whole time brew is busy. Sonner replaces same-id toasts instead.
    toast.info(describe(e), { id: 'brew-busy' });
    return;
  }
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
