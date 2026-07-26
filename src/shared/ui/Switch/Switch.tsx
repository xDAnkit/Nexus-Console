import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/cn';
import type { SwitchProps } from './Switch.types';

/** iOS-style toggle: pill track, sliding knob, accent when on. */
export const Switch = ({ checked, onChange, ariaLabel, disabled }: SwitchProps) => {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-[var(--duration-base)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border',
      )}
    >
      {/* Knob springs like the native iOS toggle — a touch of settle, no bounce past the track. */}
      <motion.span
        className="inline-block h-5 w-5 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 18 : 2 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
      />
    </button>
  );
};
