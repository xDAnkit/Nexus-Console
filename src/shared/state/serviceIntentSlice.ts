import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { bareFormula } from '@/shared/lib/format';

export type LinkState = 'linked' | 'unlinked';

export interface ManagedService {
  formula: string;
  displayName: string;
}

interface ServiceIntentState {
  /** Curated services on the Services tab — seeded from brew discovery, then user-curated. */
  managed: ManagedService[];
  /** User's link intent per formula (start vs run). Empty → default unlinked. */
  intent: Record<string, LinkState>;
  /** Set once managed has been auto-seeded from discovery (don't re-seed). */
  seeded: boolean;
  /** false until persisted intent is loaded from tauri-store. */
  hydrated: boolean;
}

export type PersistedServiceIntent = Pick<ServiceIntentState, 'managed' | 'intent' | 'seeded'>;

const initialState: ServiceIntentState = {
  managed: [],
  intent: {},
  seeded: false,
  hydrated: false,
};

const serviceIntentSlice = createSlice({
  name: 'serviceIntent',
  initialState,
  reducers: {
    seedManaged(state, action: PayloadAction<ManagedService[]>) {
      if (!state.seeded) {
        state.managed = action.payload;
        state.seeded = true;
      }
    },
    addManaged(state, action: PayloadAction<ManagedService>) {
      // Bare-name compare: `user/repo/redis` and `redis` are the same service.
      const bare = bareFormula(action.payload.formula);
      if (!state.managed.some((m) => bareFormula(m.formula) === bare)) {
        state.managed.push(action.payload);
      }
    },
    /** Point a managed entry at the formula that was actually installed — the
     * card is added as `elasticsearch` but brew only ships
     * `elastic/tap/elasticsearch-full`, and a version switch renames it too.
     * Without this the card stays stuck on "Not installed". */
    renameManaged(state, action: PayloadAction<{ from: string; to: string }>) {
      const { from, to } = action.payload;
      const entry = state.managed.find((m) => m.formula === from);
      if (!entry || from === to) return;
      entry.formula = to;
      const intent = state.intent[from];
      if (intent) {
        state.intent[to] = intent;
        delete state.intent[from];
      }
    },
    removeManaged(state, action: PayloadAction<string>) {
      state.managed = state.managed.filter((m) => m.formula !== action.payload);
      delete state.intent[action.payload];
    },
    setIntent(state, action: PayloadAction<{ formula: string; linkState: LinkState }>) {
      state.intent[action.payload.formula] = action.payload.linkState;
    },
    hydrateServiceIntent(state, action: PayloadAction<Partial<PersistedServiceIntent>>) {
      Object.assign(state, action.payload);
      state.hydrated = true;
    },
  },
});

export const {
  seedManaged,
  addManaged,
  renameManaged,
  removeManaged,
  setIntent,
  hydrateServiceIntent,
} = serviceIntentSlice.actions;
export const serviceIntentReducer = serviceIntentSlice.reducer;
