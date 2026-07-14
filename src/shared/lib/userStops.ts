// Tracks services the user just stopped, so the recorder doesn't flag the
// resulting stop as a "crash". One-shot (consumed by presence, not wall-clock) —
// polling can be arbitrarily delayed (off-tab / slow interval), so a time window
// would mis-fire. A 10-min backstop prune keeps the map from growing if a marker
// is never consumed (e.g. stopping an already-stopped service).
const stops = new Map<string, number>();

export const markUserStop = (formula: string): void => {
  const now = Date.now();
  for (const [k, t] of stops) {
    if (now - t > 600_000) stops.delete(k);
  }
  stops.set(formula, now);
};

export function consumeUserStop(formula: string): boolean {
  if (stops.has(formula)) {
    stops.delete(formula);
    return true;
  }
  return false;
}
