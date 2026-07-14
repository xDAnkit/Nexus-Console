import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ipc, CMD } from '@/shared/tauri';

const versionsSchema = z.array(z.string());

/** Available versions of a formula (base + @variants). Lazy — only fetched when
 * `enabled` (e.g. the ⋯ menu is open). */
export function useFormulaVersions(base: string, enabled: boolean) {
  return useQuery({
    queryKey: ['brew', 'versions', base],
    queryFn: () => ipc(CMD.FORMULA_VERSIONS, { name: base }, versionsSchema),
    enabled,
    staleTime: 5 * 60_000,
  });
}
