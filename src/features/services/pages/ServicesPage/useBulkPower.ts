import { useServiceControls } from '@/features/services/useServiceControls';
import type { ReconciledService } from '@/shared/brew';

export const isRunning = (s: ReconciledService) =>
  s.status === 'running' || s.status === 'starting';
export const isStartable = (s: ReconciledService) => s.status === 'stopped' || s.status === 'error';

export interface BulkResult {
  /** Successfully actioned. */
  ok: number;
  /** Rejected (command errored). */
  failed: number;
  /** Not eligible (already in the target state), so never touched. */
  skipped: number;
}

/** One-line toast summary, e.g. "Stopped 3 services · 1 failed · 2 skipped". */
export const summarizeBulk = (verb: string, r: BulkResult): string => {
  const parts = [`${verb} ${r.ok} service${r.ok === 1 ? '' : 's'}`];
  if (r.failed > 0) parts.push(`${r.failed} failed`);
  if (r.skipped > 0) parts.push(`${r.skipped} skipped`);
  return parts.join(' · ');
};

/**
 * Bulk start/stop across many services. Runs the eligible ones concurrently
 * (silent mutations — one aggregated result, not N toasts) and reports how many
 * succeeded / failed / were skipped. Reuses useServiceControls so per-service
 * intent handling is identical to the single-card path.
 */
export function useBulkPower() {
  const { start, stop } = useServiceControls({ silent: true });

  const run = async (
    services: ReconciledService[],
    eligible: (s: ReconciledService) => boolean,
    act: (s: ReconciledService) => Promise<void>,
  ): Promise<BulkResult> => {
    const targets = services.filter(eligible);
    const results = await Promise.allSettled(targets.map(act));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    return { ok, failed: targets.length - ok, skipped: services.length - targets.length };
  };

  return {
    startMany: (services: ReconciledService[]) => run(services, isStartable, start),
    stopMany: (services: ReconciledService[]) => run(services, isRunning, stop),
  };
}
