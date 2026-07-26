export type ServiceStatus =
  'running' | 'starting' | 'stopping' | 'stopped' | 'notInstalled' | 'error';

export interface StatusChipProps {
  status: ServiceStatus;
}
