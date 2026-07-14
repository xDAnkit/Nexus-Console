import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ipcVoid, CMD } from '@/shared/tauri';

export function useUpgradePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name }: { name: string }) => ipcVoid(CMD.UPGRADE_PACKAGE, { name }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useUpgradeAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ipcVoid(CMD.UPGRADE_ALL),
    onSettled: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}
