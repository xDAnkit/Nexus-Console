import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '@/shared/state/rootReducer';
import { settingsListener } from '@/shared/state/settingsPersist';
import { serviceIntentListener } from '@/shared/state/serviceIntentPersist';
import { sessionsListener } from '@/shared/state/sessionsPersist';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault().prepend(
      settingsListener.middleware,
      serviceIntentListener.middleware,
      sessionsListener.middleware,
    ),
});
