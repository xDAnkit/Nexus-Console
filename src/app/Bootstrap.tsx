import { useEffect, type PropsWithChildren } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { hydrateSettings } from '@/shared/state/settingsSlice';
import { hydrateServiceIntent } from '@/shared/state/serviceIntentSlice';
import { hydrateSessions } from '@/shared/state/sessionsSlice';
import { loadPersistedSettings } from '@/shared/state/settingsPersist';
import { loadPersistedServiceIntent } from '@/shared/state/serviceIntentPersist';
import { loadPersistedSessions } from '@/shared/state/sessionsPersist';
import { useAppContext } from '@/shared/tauri';
import { Spinner } from '@/shared/ui/Spinner';

/** Gates first paint until persisted settings are hydrated and the app context
 * query has resolved — so there's no flash of default theme or empty data. */
export const Bootstrap = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.settings.hydrated);
  const { isPending } = useAppContext();

  useEffect(() => {
    void loadPersistedSettings().then((saved) => dispatch(hydrateSettings(saved ?? {})));
    void loadPersistedServiceIntent().then((saved) => dispatch(hydrateServiceIntent(saved ?? {})));
    void loadPersistedSessions().then((saved) => dispatch(hydrateSessions(saved ?? {})));
  }, [dispatch]);

  if (!hydrated || isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }
  return children;
};
