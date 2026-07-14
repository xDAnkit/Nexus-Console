import { chipStyles, dotStyles } from './StatusChip.styles';
import { STATUS_META } from './StatusChip.config';
import type { StatusChipProps } from './StatusChip.types';

export const StatusChip = ({ status }: StatusChipProps) => (
  <span className={chipStyles({ status })}>
    <span className={dotStyles({ status })} />
    {STATUS_META[status].label}
  </span>
);
