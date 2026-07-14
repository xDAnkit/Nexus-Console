import { useEffect } from 'react';
import { useReconciledServices } from '@/shared/brew';
import { setTrayServices, setTrayTitle } from '@/shared/tauri';

const isRunning = (status: string): boolean => status === 'running' || status === 'starting';

/** Mirror the dashboard into the menu-bar tray: running-count title + service menu. */
export function useTrayTitle(): void {
  const { services } = useReconciledServices();
  useEffect(() => {
    const running = services.filter((s) => isRunning(s.status)).length;
    setTrayTitle(services.length > 0 ? `${running}/${services.length}` : '');

    // Installed managed services only; checkmark = running (matches the "n/m" count).
    setTrayServices(
      services
        .filter((s) => s.status !== 'notInstalled')
        .map((s) => ({ name: s.displayName, running: isRunning(s.status) })),
    );
  }, [services]);
}
