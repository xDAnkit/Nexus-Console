import { useSeedManagedServices } from '@/shared/brew';
import { useSessionRecorder, useTrayTitle } from '@/features/sessions';
import { AppShell } from '@/shared/layout/AppShell';
import { TerminalDrawer } from '@/features/terminal';
import { Bootstrap } from './Bootstrap';
import { MainView } from './MainView';

export const App = () => {
  useSeedManagedServices();
  useSessionRecorder();
  useTrayTitle();

  return (
    <Bootstrap>
      <AppShell footer={<TerminalDrawer />}>
        <MainView />
      </AppShell>
    </Bootstrap>
  );
};
