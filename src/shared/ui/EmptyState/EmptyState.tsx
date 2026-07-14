import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
    {icon ? <div className="text-fg-subtle">{icon}</div> : null}
    <div className="space-y-1">
      <p className="text-base font-semibold text-fg">{title}</p>
      {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
    </div>
    {action}
  </div>
);
