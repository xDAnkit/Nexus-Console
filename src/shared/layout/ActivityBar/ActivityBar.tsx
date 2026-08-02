import { useMutationState } from '@tanstack/react-query';
import { Spinner } from '@/shared/ui/Spinner';

/** Everything this app asks Homebrew to do is slow (seconds to minutes) and
 * silent — brew prints nothing until it finishes, so without this the window
 * just sits there and the user can't tell working from hung.
 *
 * Driven straight off React Query's in-flight mutations, so there's no second
 * "is something running" flag to keep in sync with reality. */
export const ActivityBar = () => {
  const labels = useMutationState({
    filters: { status: 'pending' },
    select: (m) => {
      const verb = m.meta?.label ?? 'Working';
      const vars = m.state.variables;
      const name =
        vars && typeof vars === 'object' && 'name' in vars && typeof vars.name === 'string'
          ? vars.name
          : undefined;
      return name ? `${verb} ${name}` : verb;
    },
  });

  if (labels.length === 0) return null;

  const [first, ...rest] = labels;
  const text = rest.length > 0 ? `${first} +${rest.length} more` : first;

  return (
    // <output> carries role=status + aria-live=polite implicitly, so a screen
    // reader announces the change without either attribute.
    <output className="flex shrink-0 items-center gap-2 border-b border-border bg-accent-soft px-6 py-2 text-sm text-fg">
      <Spinner className="text-accent" />
      <span className="truncate">{text}…</span>
      <span className="text-fg-muted">Homebrew can take a minute.</span>
    </output>
  );
};
