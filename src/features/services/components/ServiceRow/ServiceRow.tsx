import { StatusChip } from '@/shared/ui/StatusChip';
import { ServiceStatsInline } from '@/features/services/components/ServiceStatsInline';
import { LinkChip } from '@/features/services/components/LinkChip';
import { ServiceActions } from '@/features/services/components/ServiceActions';
import { ServiceMenu } from '@/features/services/components/ServiceMenu';
import { iconFor } from '@/features/services/components/ServiceCard';
import type { ReconciledService } from '@/shared/brew';

export const ServiceRow = ({ service }: { service: ReconciledService }) => {
  const Icon = iconFor(service.formula);
  const isRunning = service.status === 'running' || service.status === 'starting';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-paper px-4 py-2.5 transition-colors hover:bg-list/60">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-list text-fg-muted">
        <Icon className="h-4 w-4" />
      </div>
      {/* Name grows to fill slack, truncates, but keeps a floor so it never
          collapses to zero behind the action cluster. */}
      <div className="min-w-[6rem] flex-1">
        <p className="truncate text-sm font-semibold text-fg">{service.displayName}</p>
        <p className="truncate font-mono text-xs text-fg-muted">
          {service.formula}
          {service.port ? ` · :${service.port}` : ''}
        </p>
      </div>
      <StatusChip status={service.status} />
      {service.status !== 'notInstalled' && <LinkChip linkState={service.linkState} />}
      {isRunning && (
        <div className="hidden shrink-0 xl:block">
          <ServiceStatsInline
            cpu={service.cpu}
            memoryBytes={service.memoryBytes}
            uptimeSecs={service.uptimeSecs}
          />
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <ServiceActions service={service} compact />
        <ServiceMenu service={service} />
      </div>
    </div>
  );
};
