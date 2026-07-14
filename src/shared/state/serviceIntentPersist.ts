import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { RootState } from './rootReducer';
import {
  seedManaged,
  addManaged,
  removeManaged,
  setIntent,
  type PersistedServiceIntent,
} from './serviceIntentSlice';

const FILE = 'services.json';
const KEY = 'serviceIntent';

let cached: Promise<Store> | null = null;
const getStore = () => (cached ??= load(FILE, { autoSave: false, defaults: {} }));

export async function loadPersistedServiceIntent(): Promise<Partial<PersistedServiceIntent> | null> {
  try {
    const store = await getStore();
    return (await store.get<Partial<PersistedServiceIntent>>(KEY)) ?? null;
  } catch {
    return null;
  }
}

export const serviceIntentListener = createListenerMiddleware();
serviceIntentListener.startListening({
  matcher: isAnyOf(seedManaged, addManaged, removeManaged, setIntent),
  effect: async (_action, api) => {
    const { managed, intent, seeded } = (api.getState() as RootState).serviceIntent;
    const store = await getStore();
    await store.set(KEY, { managed, intent, seeded });
    await store.save();
  },
});
