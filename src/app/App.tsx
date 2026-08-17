import { lazy, Suspense } from 'react';
import { AppShell } from '@/shared/layout/AppShell';
import { useModuleEnabled } from '@/shared/modules';
import { useAppSelector } from '@/shared/state/hooks';
import { Bootstrap } from './Bootstrap';
import { HomebrewBackground } from './HomebrewBackground';
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
  useKeyboardShortcuts();
  // Gated by MOUNT, not by a flag inside the hooks: unmounting is what actually
  // stops the 4s Homebrew poll for someone who doesn't use the module.
  const homebrewOn = useModuleEnabled('homebrew');

  return (
    <Bootstrap>
      {homebrewOn && <HomebrewBackground />}
      <AppShell footer={<TerminalDrawerGate />}>
        <MainView />
      </AppShell>
    </Bootstrap>
  );
};
