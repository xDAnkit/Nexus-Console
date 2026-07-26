import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { CheckboxProps } from './Checkbox.types';

/** iOS-style selection circle (Mail/Reminders edit mode): round, accent-filled
 * with a white check when selected. A real (visually hidden) input keeps
 * native semantics; the styled circle is presentation only. */
export const Checkbox = ({ checked, onChange, ariaLabel, disabled }: CheckboxProps) => (
  <label
    className={cn(
      'relative inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center',
      disabled && 'pointer-events-none opacity-50',
    )}
  >
    <input
      type="checkbox"
      className="peer sr-only"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
    />
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-[var(--duration-fast)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
        checked ? 'border-accent bg-accent' : 'border-fg-subtle/50 hover:border-fg-subtle',
      )}
    >
      {checked && <Check className="h-3 w-3 text-accent-fg" strokeWidth={3} />}
    </span>
  </label>
);
