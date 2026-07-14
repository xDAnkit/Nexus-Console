import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ipc, CMD } from '@/shared/tauri';

const resultsSchema = z.array(z.string());

/** brew formula search, enabled once the query is ≥ 2 chars. */
export function useSearchFormulae(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['brew', 'search', q],
    queryFn: () => ipc(CMD.SEARCH_FORMULAE, { query: q }, resultsSchema),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}
