import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ipc, CMD } from '@/shared/tauri';

/** Is Claude Code on this machine? The Claude Chats module hides when not.
 * Checked once per app run — installing Claude mid-session needs a relaunch. */
export function useClaudeInstalled(): boolean {
  const { data } = useQuery({
    queryKey: ['claude', 'installed'],
    queryFn: () => ipc(CMD.CLAUDE_INSTALLED, undefined, z.boolean()),
    staleTime: Infinity,
  });
  return data === true;
}
