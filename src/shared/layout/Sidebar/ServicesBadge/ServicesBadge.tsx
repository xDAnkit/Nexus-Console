import { useReconciledServices } from '@/shared/brew';

/** The `2/4` pill on the Services nav item.
 *
 * This is a component, not a few lines inside Sidebar, for one load-bearing
 * reason: `useReconciledServices()` starts the 4s Homebrew poll, and a hook can't
 * be called conditionally. Rendered only when the Homebrew module is on, the poll
 * genuinely stops for everyone else — inline in Sidebar it would keep running and
 * quietly undo the whole point of turning the module off. */
export const ServicesBadge = () => {
  const { services } = useReconciledServices();
  if (services.length === 0) return null;

  const running = services.filter((s) => s.status === 'running' || s.status === 'starting').length;
  return (
    <span className="relative z-10 rounded-full bg-running-soft px-2 py-0.5 text-xs font-medium text-running tabular-nums">
      {running}/{services.length}
    </span>
  );
};
