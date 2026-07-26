import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const TABS = [
  'services',
  'doctor',
  'archiver',
  'packages',
  'ports',
  'sessions',
  'settings',
] as const;
export type Tab = (typeof TABS)[number];

interface UiState {
  activeTab: Tab;
}

const initialState: UiState = { activeTab: 'services' };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<Tab>) {
      state.activeTab = action.payload;
    },
  },
});

export const { setActiveTab } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
