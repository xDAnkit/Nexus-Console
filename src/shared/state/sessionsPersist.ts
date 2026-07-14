import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { RootState } from './rootReducer';
import { openRun, closeRun, clearAllSessions, type Run } from './sessionsSlice';

const FILE = 'sessions.json';
const KEY = 'runs';

let cached: Promise<Store> | null = null;
const getStore = () => (cached ??= load(FILE, { autoSave: false, defaults: {} }));

export async function loadPersistedSessions(): Promise<Record<string, Run[]> | null> {
  try {
    const store = await getStore();
    return (await store.get<Record<string, Run[]>>(KEY)) ?? null;
  } catch {
    return null;
  }
}

// Persist only CLOSED runs — open runs are re-derived on next launch from process
// uptime, so we never resurrect a stale "still running" entry.
export const sessionsListener = createListenerMiddleware();
sessionsListener.startListening({
  matcher: isAnyOf(openRun, closeRun, clearAllSessions),
  effect: async (_action, api) => {
    const { runs } = (api.getState() as RootState).sessions;
    const closed: Record<string, Run[]> = {};
    for (const [formula, list] of Object.entries(runs)) {
      const done = list.filter((r) => r.endMs !== null);
      if (done.length) closed[formula] = done;
    }
    const store = await getStore();
    await store.set(KEY, closed);
    await store.save();
  },
});
