import type { ReconciledService } from '@/shared/brew';

export interface ServiceActionsProps {
  service: ReconciledService;
  /** Dense list rows render icon-only buttons (labels via tooltip/aria). */
  compact?: boolean;
}
