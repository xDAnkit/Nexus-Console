import { bareFormula } from '@/shared/lib/format';
import type { ManagedService, LinkState } from '@/shared/state/serviceIntentSlice';
import type { ServiceDto } from './schemas';
import type { DisplayStatus, ReconciledService } from './types';

/** brew status × health → display status. brew is the truth for started/stopped;
 * a started-but-unreachable service is "starting", not green. */
export function mapStatus(dto: ServiceDto | undefined): DisplayStatus {
  if (!dto) return 'notInstalled';
  switch (dto.status) {
    case 'started':
      return dto.healthy === false ? 'starting' : 'running';
    case 'stopping':
      return 'stopping'; // synthetic: only ever set by the stop optimistic update
    case 'error':
      return 'error';
    default:
      return 'stopped'; // stopped | none | scheduled
  }
}

/** Merge the managed registry (+ user intent) with live brew data. */
export function reconcile(
  managed: ManagedService[],
  brewList: ServiceDto[],
  intent: Record<string, LinkState>,
): ReconciledService[] {
  // Keyed on the bare name: a service added from search is tap-qualified
  // (`user/repo/name@1`) while brew reports it bare (`name@1`) — matching on the
  // raw string showed an installed service as "Not installed".
  // ponytail: two taps shipping the same formula name would collide; key on the
  // full name if that ever happens for real.
  const byName = new Map(brewList.map((d) => [bareFormula(d.name), d]));
  return managed.map((m) => {
    const dto = byName.get(bareFormula(m.formula));
    return {
      formula: m.formula,
      displayName: m.displayName,
      status: mapStatus(dto),
      linkState: intent[m.formula] ?? 'unlinked',
      pid: dto?.pid ?? null,
      cpu: dto?.cpu ?? null,
      memoryBytes: dto?.memoryBytes ?? null,
      uptimeSecs: dto?.uptimeSecs ?? null,
      port: dto?.port ?? null,
      healthy: dto?.healthy ?? null,
      plist: dto?.plist ?? null,
    };
  });
}
