import * as Tooltip from '@radix-ui/react-tooltip';
import type { LinkState } from '@/shared/state/serviceIntentSlice';

/** Linked = registered with launchd (survives quit). Unlinked = ephemeral run. */
export const LinkChip = ({ linkState }: { linkState: LinkState }) => {
  const linked = linkState === 'linked';
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={
            linked
              ? 'inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent'
              : 'inline-flex items-center gap-1.5 rounded-full bg-stopped-soft px-2 py-0.5 text-xs font-medium text-stopped'
          }
        >
          <span
            className={
              linked
                ? 'h-1.5 w-1.5 rounded-full bg-accent'
                : 'h-1.5 w-1.5 rounded-full bg-stopped-dot'
            }
          />
          {linked ? 'Linked' : 'Unlinked'}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="nx-pop z-[var(--z-tooltip)] max-w-56 rounded-md border border-border bg-paper px-2.5 py-1.5 text-xs text-fg-muted shadow-sm"
        >
          {linked
            ? 'Kept running in the background (survives quit).'
            : 'Runs temporarily; stops when you quit Nexus.'}
          <Tooltip.Arrow className="fill-paper" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
