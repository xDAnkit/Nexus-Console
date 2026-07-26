import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipc, ipcVoid, CMD } from '@/shared/tauri';
import {
  archiveResultSchema,
  archivedProjectsSchema,
  bulkResultSchema,
  chatsSchema,
  claudeProjectsSchema,
  claudeSettingsSchema,
} from './archiver.schema';

/** All archiver data is one-shot (no polling — it only changes via our own
 * mutations, which invalidate ['claude']). The Archiver view only mounts when
 * opened from Doctor → Claude, so mounting is the fetch gate. */
export function useClaudeProjects() {
  return useQuery({
    queryKey: ['claude', 'projects'],
    queryFn: () => ipc(CMD.CLAUDE_PROJECTS, undefined, claudeProjectsSchema),
  });
}

export function useArchivedChats() {
  return useQuery({
    queryKey: ['claude', 'archived'],
    queryFn: () => ipc(CMD.CLAUDE_ARCHIVED, undefined, archivedProjectsSchema),
  });
}

export function useClaudeSettings() {
  return useQuery({
    queryKey: ['claude', 'settings'],
    queryFn: () => ipc(CMD.CLAUDE_SETTINGS, undefined, claudeSettingsSchema),
  });
}

/** Live (un-archived) sessions of one project — fetched when it's selected. */
export function useLiveSessions(dirName: string | null) {
  return useQuery({
    queryKey: ['claude', 'sessions', dirName],
    queryFn: () => ipc(CMD.CLAUDE_SESSIONS, { dirName }, chatsSchema),
    enabled: dirName != null,
  });
}

/** Archive an explicit selection of chats (move-only, never overwrites). */
export function useArchiveFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dirName, files }: { dirName: string; files: string[] }) =>
      ipc(CMD.CLAUDE_ARCHIVE_FILES, { dirName, files }, bulkResultSchema),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude'] }),
  });
}

/** Cutoff archive — the native macOS dialog (shown by Rust with the real
 * count) is the confirm, so no preview round-trip is needed anymore. */
export function useArchiveApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dirName, cutoffDays }: { dirName: string; cutoffDays: number }) =>
      ipc(CMD.CLAUDE_ARCHIVE, { dirName, cutoffDays, apply: true }, archiveResultSchema),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude'] }),
  });
}

export function useRestoreChats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dirName, files }: { dirName: string; files: string[] }) =>
      ipc(CMD.CLAUDE_RESTORE, { dirName, files }, bulkResultSchema),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude'] }),
  });
}

/** Permanent delete from the archive — always behind the confirm dialog. */
export function useDeleteChats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folder, files }: { folder: string; files: string[] }) =>
      ipc(CMD.CLAUDE_DELETE, { folder, files }, bulkResultSchema),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude'] }),
  });
}

/** Permanent delete of LIVE chats (skips the archive) — confirm-gated in Rust. */
export function useDeleteLiveChats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dirName, files }: { dirName: string; files: string[] }) =>
      ipc(CMD.CLAUDE_DELETE_LIVE, { dirName, files }, bulkResultSchema),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude'] }),
  });
}

export function useSetRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ days }: { days: number }) => ipcVoid(CMD.CLAUDE_SET_RETENTION, { days }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['claude', 'settings'] }),
  });
}
