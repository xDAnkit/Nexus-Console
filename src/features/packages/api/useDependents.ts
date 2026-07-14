import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ipc, CMD } from '@/shared/tauri';

/** Installed formulae that depend on `name` — fetched when the uninstall dialog opens. */
export function useDependents(name: string | null) {
  return useQuery({
    queryKey: ['dependents', name],
    queryFn: () => ipc(CMD.PACKAGE_DEPENDENTS, { name }, z.array(z.string())),
    enabled: name !== null,
    staleTime: 30_000,
  });
}
