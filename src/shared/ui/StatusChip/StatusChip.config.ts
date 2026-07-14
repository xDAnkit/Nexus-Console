import type { ServiceStatus } from './StatusChip.types';

/** Label per status — status is conveyed by text + dot, never color alone (a11y). */
export const STATUS_META: Record<ServiceStatus, { label: string }> = {
  running: { label: 'Running' },
  starting: { label: 'Starting' },
  stopped: { label: 'Stopped' },
  notInstalled: { label: 'Not installed' },
  error: { label: 'Error' },
};
