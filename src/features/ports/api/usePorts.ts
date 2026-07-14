import { useQuery } from '@tanstack/react-query';
import { ipc, CMD } from '@/shared/tauri';
import { useAppSelector } from '@/shared/state/hooks';
import { useEffectivePollMs } from '@/shared/brew';
import { portsSchema } from './ports.schema';

/** Listening ports (or all connections). Only runs on the Ports tab + focused. */
export function usePorts(listeningOnly: boolean) {
  const isPortsTab = useAppSelector((s) => s.ui.activeTab === 'ports');
  const pollMs = useEffectivePollMs();
  return useQuery({
    queryKey: ['ports', listeningOnly],
    queryFn: () => ipc(CMD.LIST_PORTS, { listeningOnly }, portsSchema),
    enabled: isPortsTab,
    refetchInterval: isPortsTab ? pollMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
