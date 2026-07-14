import type { ServiceStatus } from '@/shared/ui/StatusChip';
import type { LinkState } from '@/shared/state/serviceIntentSlice';

/** Display status derives from brew status × health (started+unreachable → starting). */
export type DisplayStatus = ServiceStatus;

/** A managed service enriched with live brew data — what the Services tab renders. */
export interface ReconciledService {
  formula: string;
  displayName: string;
  status: DisplayStatus;
  linkState: LinkState;
  pid: number | null;
  cpu: number | null;
  memoryBytes: number | null;
  uptimeSecs: number | null;
  port: number | null;
  healthy: boolean | null;
  plist: string | null;
}
