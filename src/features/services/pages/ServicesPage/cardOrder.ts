/** Pure ordering helpers for drag-to-reorder of service cards. */

/** Stable-sort items by their formula's index in `order`; unknown formulas last. */
export function applyCardOrder<T extends { formula: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items;
  const rank = new Map(order.map((f, i) => [f, i]));
  return items
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) =>
        (rank.get(a.s.formula) ?? Infinity) - (rank.get(b.s.formula) ?? Infinity) || a.i - b.i,
    )
    .map((x) => x.s);
}

/**
 * Splice a reordered subset of visible formulas back into the full ordered list,
 * so cards filtered out of view keep their absolute positions.
 */
export function mergeVisibleOrder<T extends { formula: string }>(
  full: T[],
  visible: string[],
): string[] {
  const shown = new Set(visible);
  const queue = [...visible];
  return full.map((s) => (shown.has(s.formula) ? queue.shift()! : s.formula));
}
