import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { ipc, CMD } from '@/shared/tauri';

interface FixMeta {
  label: string;
  /** Dedicated command; absent → the generic whitelisted doctor_fix runner. */
  cmd?: string;
}

/** finding.fix id → how the UI runs it. Every fix re-scans its own targets
 * server-side and destructive ones are confirm-gated by a NATIVE dialog in
 * Rust — the frontend never passes paths and never owns the confirm. */
const FIX_COMMANDS: Record<string, FixMeta> = {
  vscode_cleanup_orphans: { cmd: CMD.VSCODE_CLEANUP_ORPHANS, label: 'Delete orphan caches' },
  vscode_vacuum: { cmd: CMD.VSCODE_VACUUM, label: 'VACUUM now' },
  deep_dead_node_modules: { label: 'Delete dead node_modules' },
  deep_stale_node_modules: { label: 'Delete stale node_modules' },
  cache_npm: { label: 'Clear cache' },
  cache_uv: { label: 'Clear cache' },
  cache_huggingface: { label: 'Clear cache' },
  cache_puppeteer: { label: 'Clear cache' },
  cache_gradle: { label: 'Clear cache' },
  cache_deriveddata: { label: 'Clear cache' },
};

export function fixMeta(fixId: string | null): FixMeta | null {
  if (!fixId) return null;
  // Parameterized fixes: the backend validates the parameter against the
  // actual installed set — these labels are purely presentational.
  if (fixId.startsWith('ollama_rm:')) return { label: 'Delete model' };
  if (fixId.startsWith('browser_cache:')) return { label: 'Clear cache' };
  if (fixId.startsWith('vscode_ext_rm:')) return { label: 'Uninstall' };
  // browser_ext_manage:<browser>:<id> — non-destructive, opens its own page.
  if (fixId.startsWith('browser_ext_manage:')) return { label: `Manage in ${fixId.split(':')[1]}` };
  return FIX_COMMANDS[fixId] ?? null;
}

/** Runs a fix and returns its before/after summary line. */
export function useDoctorFix() {
  return useMutation({
    mutationFn: ({ fixId }: { fixId: string }) => {
      const meta = fixMeta(fixId);
      if (!meta) return Promise.reject(new Error(`Unknown fix: ${fixId}`));
      return meta.cmd
        ? ipc(meta.cmd, undefined, z.string())
        : ipc(CMD.DOCTOR_FIX, { fixId }, z.string());
    },
  });
}
