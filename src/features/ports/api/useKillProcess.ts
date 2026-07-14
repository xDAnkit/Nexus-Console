import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcVoid, CMD } from '@/shared/tauri';

interface KillArgs {
  pid: number;
  force: boolean;
  sudo: boolean;
}

/** SIGTERM / SIGKILL a process (optionally via the admin prompt). Refreshes ports on settle. */
export function useKillProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, force, sudo }: KillArgs) => ipcVoid(CMD.KILL_PROCESS, { pid, force, sudo }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['ports'] }),
  });
}
