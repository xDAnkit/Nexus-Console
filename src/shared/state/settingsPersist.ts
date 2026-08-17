import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { RootState } from './rootReducer';
import {
  setTheme,
  setLayout,
  setPollInterval,
  setQuitBehavior,
  setCardOrder,
  setEnabledModules,
  setAutoArchiveEnabled,
  setAutoArchiveCutoffDays,
  setAutoVacuumEnabled,
  type PersistedSettings,
} from './settingsSlice';

const FILE = 'settings.json';
const KEY = 'settings';

let cached: Promise<Store> | null = null;
const getStore = () => (cached ??= load(FILE, { autoSave: false, defaults: {} }));

/** Read persisted settings on boot. Returns null on first run or non-Tauri dev. */
export async function loadPersistedSettings(): Promise<Partial<PersistedSettings> | null> {
  try {
    const store = await getStore();
    return (await store.get<Partial<PersistedSettings>>(KEY)) ?? null;
  } catch {
    return null;
  }
}

// Writes settings back to disk whenever one changes.
// ponytail: no debounce — settings toggles are infrequent; add one if it churns.
export const settingsListener = createListenerMiddleware();
settingsListener.startListening({
  matcher: isAnyOf(
    setTheme,
    setLayout,
    setPollInterval,
    setQuitBehavior,
    setCardOrder,
    setEnabledModules,
    setAutoArchiveEnabled,
    setAutoArchiveCutoffDays,
    setAutoVacuumEnabled,
  ),
  effect: async (_action, api) => {
    const {
      theme,
      layout,
      pollIntervalMs,
      quitBehavior,
      cardOrder,
      enabledModules,
      autoArchiveEnabled,
      autoArchiveCutoffDays,
      autoVacuumEnabled,
    } = (api.getState() as RootState).settings;
    const store = await getStore();
    await store.set(KEY, {
      theme,
      layout,
      pollIntervalMs,
      quitBehavior,
      cardOrder,
      enabledModules,
      autoArchiveEnabled,
      autoArchiveCutoffDays,
      autoVacuumEnabled,
    });
    await store.save();
  },
});
