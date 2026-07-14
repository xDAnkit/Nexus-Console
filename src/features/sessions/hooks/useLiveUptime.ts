import { useEffect, useState } from 'react';
import { useAppSelector } from '@/shared/state/hooks';

/** Live uptime (seconds) of a service's current run, ticking every second.
 * null when the service isn't running. */
export function useLiveUptime(formula: string): number | null {
  const startMs = useAppSelector((s) => {
    const last = s.sessions.runs[formula]?.at(-1);
    return last && last.endMs === null ? last.startMs : null;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (startMs === null) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return startMs === null ? null : Math.max(0, Math.floor((nowMs - startMs) / 1000));
}
