import { Cpu, MemoryStick, Clock } from 'lucide-react';
import { formatBytes, formatDuration, formatPercent } from '@/shared/lib/format';
import type { ServiceStatsInlineProps } from './ServiceStatsInline.types';

export const ServiceStatsInline = ({ cpu, memoryBytes, uptimeSecs }: ServiceStatsInlineProps) => (
  <div className="flex items-center gap-3 text-xs text-fg-muted tabular-nums">
    <span className="inline-flex items-center gap-1">
      <Cpu className="h-3.5 w-3.5" />
      {formatPercent(cpu)}
    </span>
    <span className="inline-flex items-center gap-1">
      <MemoryStick className="h-3.5 w-3.5" />
      {formatBytes(memoryBytes)}
    </span>
    <span className="inline-flex items-center gap-1">
      <Clock className="h-3.5 w-3.5" />
      {formatDuration(uptimeSecs)}
    </span>
  </div>
);
