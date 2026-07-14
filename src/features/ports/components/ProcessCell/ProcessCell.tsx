export const ProcessCell = ({ command, user }: { command: string; user: string }) => (
  <div className="min-w-0">
    <p className="truncate text-sm text-fg">{command}</p>
    <p className="truncate text-xs text-fg-muted">{user}</p>
  </div>
);
