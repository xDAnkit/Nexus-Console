import { StatusChip } from '@/shared/ui/StatusChip';
import { ServiceStatsInline } from '@/features/services/components/ServiceStatsInline';
import { LinkChip } from '@/features/services/components/LinkChip';
import { ServiceActions } from '@/features/services/components/ServiceActions';
import { ServiceMenu } from '@/features/services/components/ServiceMenu';
import { cn } from '@/shared/lib/cn';
import { cardStyles } from './ServiceCard.styles';
import { iconFor } from './ServiceCard.config';
import type { ServiceCardProps } from './ServiceCard.types';

export const ServiceCard = ({ service }: ServiceCardProps) => {
  const Icon = iconFor(service.formula);
  // Installed (active/stopped) cards de-emphasise the icon + process line so the
  // name + status read first; not-installed cards stay crisp to draw the eye.
  const dim = service.status !== 'notInstalled';

  return (
    <div className={cardStyles}>
      {/* Info region grows so the footer pins to the card bottom — every
          card in a row shares one height, and every action row lines up. */}
      <div className="flex-1">
        {/* Header: identity + overflow menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-list text-fg-muted',
                dim && 'opacity-55',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-fg">{service.displayName}</h3>
              <p className={cn('truncate font-mono text-xs text-fg-muted', dim && 'opacity-60')}>
                {service.formula}
                {service.port ? ` · :${service.port}` : ''}
              </p>
            </div>
          </div>
          <ServiceMenu service={service} />
        </div>

        {/* Status */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <StatusChip status={service.status} />
          {service.status !== 'notInstalled' && <LinkChip linkState={service.linkState} />}
        </div>

        {/* Live metrics — always shown for installed services; a stopped
            service reads 0 (not hidden) so cards stay uniform. */}
        {service.status !== 'notInstalled' && (
          <div className="mt-2">
            <ServiceStatsInline
              cpu={service.cpu ?? 0}
              memoryBytes={service.memoryBytes ?? 0}
              uptimeSecs={service.uptimeSecs ?? 0}
            />
          </div>
        )}
      </div>

      {/* Action footer — one grouped row, divided from the info above */}
      <div className="mt-3 border-t border-border pt-2.5">
        <ServiceActions service={service} />
      </div>
    </div>
  );
};
