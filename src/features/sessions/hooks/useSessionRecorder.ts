import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/shared/state/hooks';
import { openRun, closeRun } from '@/shared/state/sessionsSlice';
import { useReconciledServices } from '@/shared/brew';
import { consumeUserStop } from '@/shared/lib/userStops';
import { notifyCrash } from '@/shared/tauri';

/** Records run history by diffing successive service polls, and fires a crash
 * notification when a service stops without the user having stopped it. */
export function useSessionRecorder(): void {
  const dispatch = useAppDispatch();
  const { services } = useReconciledServices();
  const prev = useRef<Record<string, string>>({});

  useEffect(() => {
    const now = Date.now();
    const seen = new Set<string>();

    for (const s of services) {
      seen.add(s.formula);
      const was = prev.current[s.formula];
      const wasRunning = was === 'running' || was === 'starting';
      const isRunning = s.status === 'running' || s.status === 'starting';
      // Only 'stopped'/'error' is a definite stop. 'notInstalled' is ambiguous
      // (a transient empty brew list looks like this) — leave prev unchanged.
      const isStopped = s.status === 'stopped' || s.status === 'error';

      if (!wasRunning && isRunning) {
        dispatch(openRun({ formula: s.formula, startMs: now - (s.uptimeSecs ?? 0) * 1000 }));
        prev.current[s.formula] = s.status;
      } else if (wasRunning && isStopped) {
        dispatch(closeRun({ formula: s.formula, endMs: now }));
        if (!consumeUserStop(s.formula)) void notifyCrash(s.displayName);
        prev.current[s.formula] = s.status;
      } else if (isRunning || isStopped) {
        prev.current[s.formula] = s.status;
      }
    }

    // A service removed from `managed` drops out of `services`: close its open
    // run (no crash) and forget it, so re-adding later can't fire a false alert.
    for (const formula of Object.keys(prev.current)) {
      if (!seen.has(formula)) {
        dispatch(closeRun({ formula, endMs: now }));
        delete prev.current[formula];
      }
    }
  }, [services, dispatch]);
}
