import type { DisplayStatus } from '@/shared/brew';

export type PowerFace = 'start' | 'stop';

export interface PowerState {
  /** Which action the button offers: primary Start vs. secondary Stop. */
  face: PowerFace;
  /** Show the spinner instead of the icon (a transition is in progress). */
  loading: boolean;
  /** Non-clickable — only while the brew command itself is running, so a
   * service that's slow to become healthy stays abortable. */
  disabled: boolean;
}

/**
 * Derive the Start/Stop button from the REAL reconciled service status plus the
 * in-flight mutation — never from the mutation alone.
 *
 * `starting` = brew has launched the service but it isn't listening on its port
 * yet (health signal). That transitional state is the loader: we keep spinning
 * until a poll reports a healthy `running`, then flip to Stop. Stop has no
 * lingering brew status, so its command-pending window is the whole transition.
 */
export function powerState(
  status: DisplayStatus,
  startPending: boolean,
  stopPending: boolean,
): PowerState {
  if (startPending) return { face: 'start', loading: true, disabled: true }; // launching
  if (stopPending) return { face: 'stop', loading: true, disabled: true }; // stopping
  if (status === 'starting') return { face: 'stop', loading: true, disabled: false }; // coming up
  if (status === 'running') return { face: 'stop', loading: false, disabled: false };
  return { face: 'start', loading: false, disabled: false }; // stopped / error / anything else
}
