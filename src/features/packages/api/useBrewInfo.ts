import { useQuery } from '@tanstack/react-query';
import { ipc, CMD } from '@/shared/tauri';
import { packageInfoSchema } from './packages.schema';

/** `brew info` for one package — fetched only when a row is selected. */
export function useBrewInfo(name: string | null) {
  return useQuery({
    queryKey: ['package-info', name],
    queryFn: () => ipc(CMD.PACKAGE_INFO, { name }, packageInfoSchema),
    enabled: name !== null,
    staleTime: 5 * 60_000,
  });
}
