import { useQuery } from '@tanstack/react-query';
import { ipc, CMD } from '@/shared/tauri';
import { useAppSelector } from '@/shared/state/hooks';
import { packagesSchema, outdatedSchema } from './packages.schema';

/** All installed formulae + casks. Fetched on the Packages tab; searched client-side. */
export function usePackages() {
  const isPackagesTab = useAppSelector((s) => s.ui.activeTab === 'packages');
  return useQuery({
    queryKey: ['packages'],
    queryFn: () => ipc(CMD.LIST_PACKAGES, undefined, packagesSchema),
    enabled: isPackagesTab,
    staleTime: 60_000,
  });
}

/** Outdated status — a slower brew call, fetched in the background so the list
 * renders immediately and badges fill in when this resolves. Same `['packages']`
 * key prefix, so upgrade/uninstall invalidations refresh it too. */
export function usePackagesOutdated() {
  const isPackagesTab = useAppSelector((s) => s.ui.activeTab === 'packages');
  return useQuery({
    queryKey: ['packages', 'outdated'],
    queryFn: () => ipc(CMD.PACKAGES_OUTDATED, undefined, outdatedSchema),
    enabled: isPackagesTab,
    staleTime: 60_000,
  });
}
