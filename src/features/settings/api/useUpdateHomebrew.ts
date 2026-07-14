import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ipcVoid, CMD } from '@/shared/tauri';

export function useUpdateHomebrew() {
  return useMutation({
    mutationFn: () => ipcVoid(CMD.UPDATE_HOMEBREW),
    onSuccess: () => toast.success('Homebrew formula definitions updated'),
  });
}
