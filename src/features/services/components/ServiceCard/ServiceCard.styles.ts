/** One neutral card shell; status is carried by the StatusChip, not the border,
 * so every card reads with equal visual weight (clean, enterprise).
 * Fixed height (min-h-60) so every card is uniform and none resizes when a
 * service starts and its live-stats row appears — no layout jump. */
export const cardStyles =
  'flex h-full min-h-44 flex-col rounded-xl border border-border bg-paper p-3.5 transition-colors hover:border-fg-subtle/40';
