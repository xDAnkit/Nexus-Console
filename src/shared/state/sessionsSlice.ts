import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Run {
  startMs: number;
  endMs: number | null; // null → currently running
}

interface SessionsState {
  runs: Record<string, Run[]>; // formula → runs (oldest first, capped)
  hydrated: boolean;
}

const CAP = 50;
const initialState: SessionsState = { runs: {}, hydrated: false };

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    openRun(state, action: PayloadAction<{ formula: string; startMs: number }>) {
      const { formula, startMs } = action.payload;
      const arr = (state.runs[formula] ??= []);
      if (arr.at(-1)?.endMs === null) return; // already open
      // Clamp a backdated start so it can't overlap the previous run (after restart).
      const clamped = Math.max(startMs, arr.at(-1)?.endMs ?? 0);
      arr.push({ startMs: clamped, endMs: null });
      if (arr.length > CAP) arr.splice(0, arr.length - CAP);
    },
    closeRun(state, action: PayloadAction<{ formula: string; endMs: number }>) {
      const last = state.runs[action.payload.formula]?.at(-1);
      if (last && last.endMs === null) last.endMs = action.payload.endMs;
    },
    clearAllSessions(state) {
      state.runs = {};
    },
    hydrateSessions(state, action: PayloadAction<Record<string, Run[]>>) {
      state.runs = action.payload;
      state.hydrated = true;
    },
  },
});

export const { openRun, closeRun, clearAllSessions, hydrateSessions } = sessionsSlice.actions;
export const sessionsReducer = sessionsSlice.reducer;
