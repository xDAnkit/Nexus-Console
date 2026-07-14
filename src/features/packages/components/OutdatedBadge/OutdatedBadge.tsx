export const OutdatedBadge = ({ latestVersion }: { latestVersion: string | null }) => (
  <span className="inline-flex items-center rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
    {latestVersion ? `${latestVersion} available` : 'Outdated'}
  </span>
);
