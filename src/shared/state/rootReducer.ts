import { combineReducers } from '@reduxjs/toolkit';
import { uiReducer } from './uiSlice';
import { settingsReducer } from './settingsSlice';
import { serviceIntentReducer } from './serviceIntentSlice';
import { terminalsReducer } from './terminalsSlice';
import { sessionsReducer } from './sessionsSlice';

// Own the root shape here (not app/store) so RootState + typed hooks live in
// shared/ — nothing imports upward from app/. app/store just wires middleware.
export const rootReducer = combineReducers({
  ui: uiReducer,
  settings: settingsReducer,
  serviceIntent: serviceIntentReducer,
  terminals: terminalsReducer,
  sessions: sessionsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
