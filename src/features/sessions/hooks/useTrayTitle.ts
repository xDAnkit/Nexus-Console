import { useEffect, useRef } from 'react';
import { useReconciledServices } from '@/shared/brew';
import { setTrayServices, setTrayTitle } from '@/shared/tauri';

const isRunning = (status: string): boolean => status === 'running' || status === 'starting';

/** Mirror the dashboard into the menu-bar tray: running-count title + service menu.
 * `services` gets a new array reference on every poll tick even when nothing
 * tray-relevant changed (cpu/uptime numbers) — skip the two tray IPC calls
 * unless the tray-relevant signature (name, installed, running) actually changed. */
export function useTrayTitle(): void {
  const { services } = useReconciledServices();
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    const signature = services
      .map((s) => `${s.displayName}:${s.status !== 'notInstalled'}:${isRunning(s.status)}`)
      .join('|');
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

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
