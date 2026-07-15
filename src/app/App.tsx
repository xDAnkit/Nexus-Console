import { lazy, Suspense } from 'react';
import { useSeedManagedServices } from '@/shared/brew';
// Deep imports (not the feature barrel): the barrel re-exports SessionsPage,
// which would chain the whole sessions+services graph into the initial chunk
// and defeat the per-tab lazy split (build warns INEFFECTIVE_DYNAMIC_IMPORT).
import { useSessionRecorder } from '@/features/sessions/hooks/useSessionRecorder';
import { useTrayTitle } from '@/features/sessions/hooks/useTrayTitle';
import { AppShell } from '@/shared/layout/AppShell';
import { useAppSelector } from '@/shared/state/hooks';
import { Bootstrap } from './Bootstrap';
import { MainView } from './MainView';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

// xterm (+addon+css) loads only when a terminal session actually exists.
const TerminalDrawer = lazy(() =>
  import('@/features/terminal/components/TerminalDrawer').then((m) => ({
    default: m.TerminalDrawer,
  })),
);

// The gate lives OUTSIDE the lazy component — React.lazy fetches the chunk on
// first render even if the component itself returns null.
const TerminalDrawerGate = () => {
  const hasSessions = useAppSelector((s) => s.terminals.sessions.length > 0);
  if (!hasSessions) return null;
  return (
    <Suspense fallback={null}>
      <TerminalDrawer />
    </Suspense>
  );
};

export const App = () => {
  useSeedManagedServices();
  useSessionRecorder();
  useTrayTitle();
  useKeyboardShortcuts();

  return (
    <Bootstrap>
      <AppShell footer={<TerminalDrawerGate />}>
        <MainView />
      </AppShell>
    </Bootstrap>
  );
};
