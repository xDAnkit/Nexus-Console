import { useState } from 'react';
import { Check } from 'lucide-react';
import { MODULES, isModuleAvailable, useClaudeInstalled, type ModuleId } from '@/shared/modules';
import { cn } from '@/shared/lib/cn';
import type { FeaturePickerProps } from './FeaturePicker.types';

const MIN_MESSAGE = 'Keep at least one feature on.';

/** The module cards — shared by the first-run screen and Settings → Features, so
 * the two surfaces can never drift apart.
 *
 * Each card is a real (visually hidden) checkbox wrapped in its label, the same
 * idiom as `shared/ui/Checkbox`: native semantics and keyboard behaviour for free,
 * with the card as pure presentation.
 *
 * The min-one rule is enforced here rather than in each surface: unchecking the
 * last feature is refused with an inline line instead of silently doing nothing
 * (the reducer refuses it too — this is the explanation, not the guard). */
export const FeaturePicker = ({ value, onChange }: FeaturePickerProps) => {
  const claudeInstalled = useClaudeInstalled();
  const [blocked, setBlocked] = useState(false);

  const toggle = (id: ModuleId) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    if (next.length === 0) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    onChange(next);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODULES.map((m) => {
          const available = isModuleAvailable(m.id, { claudeInstalled });
          const checked = value.includes(m.id) && available;
          const Icon = m.icon;
          return (
            <label
              key={m.id}
              aria-label={m.label}
              className={cn('block', available ? 'cursor-pointer' : 'cursor-not-allowed')}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                disabled={!available}
                onChange={() => toggle(m.id)}
                aria-label={m.label}
              />
              <span
                className={cn(
                  'flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors duration-[var(--duration-fast)]',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                  checked ? 'border-accent bg-accent-soft' : 'border-border bg-paper',
                  available ? 'hover:border-accent/60' : 'opacity-60',
                )}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      checked ? 'bg-accent text-accent-fg' : 'bg-list text-fg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{m.label}</span>
                    <span className="block text-xs text-fg-muted">{m.blurb}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      checked ? 'border-accent bg-accent' : 'border-fg-subtle/50',
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-accent-fg" strokeWidth={3} />}
                  </span>
                </span>

                <span className="border-t border-border pt-2.5 text-xs text-fg-subtle">
                  {available
                    ? (m.background ?? 'Nothing runs in the background.')
                    : 'Claude Code not found on this Mac.'}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* aria-live so the refusal is announced, not just drawn. */}
      <p aria-live="polite" className="min-h-4 text-xs text-warn">
        {blocked ? MIN_MESSAGE : ''}
      </p>
    </>
  );
};
