import { lazy, Suspense, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { hydrateSettings } from '@/shared/state/settingsSlice';
import { hydrateServiceIntent } from '@/shared/state/serviceIntentSlice';
import { hydrateSessions } from '@/shared/state/sessionsSlice';
import { loadPersistedSettings } from '@/shared/state/settingsPersist';
import { loadPersistedServiceIntent } from '@/shared/state/serviceIntentPersist';
import { loadPersistedSessions } from '@/shared/state/sessionsPersist';
import { sanitizeModules } from '@/shared/modules';
import { useAppContext, showMainWindow } from '@/shared/tauri';
import { SplashScreen } from '@/shared/ui/SplashScreen';

// Shown once in an install's lifetime — lazy so it never sits in the initial
// chunk for everyone who has already chosen.
const WelcomeScreen = lazy(() =>
  import('./WelcomeScreen').then((m) => ({
    default: m.WelcomeScreen,
  })),
);

// Kicked at module eval so the store IPC/disk reads overlap JS parse + first
// render instead of waiting for the first commit's effect.
const persisted = Promise.all([
  loadPersistedSettings(),
  loadPersistedServiceIntent(),
  loadPersistedSessions(),
]);

// The window launches hidden (tauri.conf.json `visible: false`) and is revealed
// here, already themed and showing the splash — no white flash. Splash holds a
// minimum beat so a fast boot doesn't read as a glitch-blink, then crossfades.
const MIN_SPLASH_MS = 400;
const FADE_MS = 240; // matches --duration-slow on the splash opacity transition

type Phase = 'splash' | 'leaving' | 'done';

/** Gates first paint until persisted settings are hydrated and the app context
 * query has resolved — no flash of default theme or empty data — behind a
 * branded splash that crossfades into the app. */
export const Bootstrap = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.settings.hydrated);
  const { isPending } = useAppContext();
  const ready = hydrated && !isPending;
  // null = this install has never chosen its modules → first-run picker instead
  // of the app (see sanitizeModules for how "never chosen" is told apart from
  // "existing install, key not written yet").
  const needsModuleChoice = useAppSelector((s) => s.settings.enabledModules) === null;

  const [phase, setPhase] = useState<Phase>('splash');
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    void persisted.then(([settings, intent, sessions]) => {
      dispatch(
        hydrateSettings({
          ...(settings ?? {}),
          // Disk is a trust boundary: drop unknown module ids, and tell "never
          // chosen" (null → first-run picker) apart from "existing install
          // without the key yet" (→ everything on, no onboarding wall).
          enabledModules: sanitizeModules(settings?.enabledModules, settings !== null),
        }),
      );
      dispatch(hydrateServiceIntent(intent ?? {}));
      dispatch(hydrateSessions(sessions ?? {}));
    });
    // First commit: splash is painted (pre-paint theme script already themed
    // the canvas) — safe to reveal the hidden window.
    void showMainWindow();
  }, [dispatch]);

  useEffect(() => {
    if (!ready || phase !== 'splash') return;
    const hold = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => setPhase('leaving'), hold);
    return () => clearTimeout(t);
  }, [ready, phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => setPhase('done'), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <>
      {ready &&
        (needsModuleChoice ? (
          <Suspense fallback={null}>
            <WelcomeScreen />
          </Suspense>
        ) : (
          children
        ))}
      {phase !== 'done' && <SplashScreen leaving={phase === 'leaving'} />}
    </>
  );
};
