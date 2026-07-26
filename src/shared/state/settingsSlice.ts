import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Layout = 'grid' | 'list';
export type QuitBehavior = 'stopUnlinked' | 'keepAll';

interface SettingsState {
  theme: ThemeMode;
  layout: Layout;
  pollIntervalMs: number;
  quitBehavior: QuitBehavior;
  /** User drag-reorder of service cards, by formula. Unknown/new formulas sort last. */
  cardOrder: string[];
  /** Tray automation (read by the Rust scheduler from the same store file). */
  autoArchiveEnabled: boolean;
  autoArchiveCutoffDays: number;
  autoVacuumEnabled: boolean;
  /** false until persisted settings are loaded from tauri-store on boot. */
  hydrated: boolean;
}

/** The subset written to disk (never persist `hydrated`). */
export type PersistedSettings = Pick<
  SettingsState,
  | 'theme'
  | 'layout'
  | 'pollIntervalMs'
  | 'quitBehavior'
  | 'cardOrder'
  | 'autoArchiveEnabled'
  | 'autoArchiveCutoffDays'
  | 'autoVacuumEnabled'
>;

const initialState: SettingsState = {
  theme: 'system',
  layout: 'grid',
  pollIntervalMs: 4000,
  quitBehavior: 'stopUnlinked',
  cardOrder: [],
  autoArchiveEnabled: false,
  autoArchiveCutoffDays: 30,
  autoVacuumEnabled: false,
  hydrated: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    setLayout(state, action: PayloadAction<Layout>) {
      state.layout = action.payload;
    },
    setPollInterval(state, action: PayloadAction<number>) {
      state.pollIntervalMs = action.payload;
    },
    setQuitBehavior(state, action: PayloadAction<QuitBehavior>) {
      state.quitBehavior = action.payload;
    },
    setCardOrder(state, action: PayloadAction<string[]>) {
      state.cardOrder = action.payload;
    },
    setAutoArchiveEnabled(state, action: PayloadAction<boolean>) {
      state.autoArchiveEnabled = action.payload;
    },
    setAutoArchiveCutoffDays(state, action: PayloadAction<number>) {
      state.autoArchiveCutoffDays = action.payload;
    },
    setAutoVacuumEnabled(state, action: PayloadAction<boolean>) {
      state.autoVacuumEnabled = action.payload;
    },
    hydrateSettings(state, action: PayloadAction<Partial<PersistedSettings>>) {
      Object.assign(state, action.payload);
      state.hydrated = true;
    },
  },
});

export const {
  setTheme,
  setLayout,
  setPollInterval,
  setQuitBehavior,
  setCardOrder,
  setAutoArchiveEnabled,
  setAutoArchiveCutoffDays,
  setAutoVacuumEnabled,
  hydrateSettings,
} = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
