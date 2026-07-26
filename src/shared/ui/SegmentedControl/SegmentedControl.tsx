import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/cn';
import type { SegmentedControlProps } from './SegmentedControl.types';

export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) => {
  const reduce = useReducedMotion();
  // Per-instance id so two controls on one screen don't share the sliding pill.
  const groupId = useId();
  return (
    <fieldset
      aria-label={ariaLabel}
      className="m-0 inline-flex min-w-0 rounded-lg border border-border bg-paper p-0.5"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
              active ? 'text-accent-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {/* Shared-layout pill slides between segments — the macOS control feel. */}
            {active && (
              <motion.span
                aria-hidden
                layoutId={groupId}
                className="absolute inset-0 rounded-md bg-accent"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                }
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </fieldset>
  );
};
