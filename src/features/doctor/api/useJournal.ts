import { useQuery } from '@tanstack/react-query';
import { ipc, CMD } from '@/shared/tauri';
import { journalSchema } from './doctor.schema';

/** The mutation audit trail — key starts with 'claude' so every archiver /
 * fix mutation invalidation refreshes it too. */
export function useJournal(enabled: boolean) {
  return useQuery({
    queryKey: ['claude', 'journal'],
    queryFn: () => ipc(CMD.DOCTOR_JOURNAL, undefined, journalSchema),
    enabled,
  });
}
