import { cn } from '@/shared/lib/cn';
import type { SegmentedControlProps } from './SegmentedControl.types';

export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) => (
  <fieldset
    aria-label={ariaLabel}
    className="m-0 inline-flex min-w-0 rounded-lg border border-border bg-paper p-0.5"
  >
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        aria-pressed={value === o.value}
        onClick={() => onChange(o.value)}
        className={cn(
          'rounded-md px-3 py-1 text-sm font-medium transition-colors',
          value === o.value ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg',
        )}
      >
        {o.label}
      </button>
    ))}
  </fieldset>
);
