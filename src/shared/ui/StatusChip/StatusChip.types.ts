export type ServiceStatus = 'running' | 'starting' | 'stopped' | 'notInstalled' | 'error';

export interface StatusChipProps {
  status: ServiceStatus;
}
