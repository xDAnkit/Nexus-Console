import { useEffect } from 'react';
import { useSeedManagedServices } from '@/shared/brew';
// Deep imports (not the feature barrel): the barrel re-exports SessionsPage,
// which would chain the whole sessions+services graph into the initial chunk
// and defeat the per-tab lazy split (build warns INEFFECTIVE_DYNAMIC_IMPORT).
import { useSessionRecorder } from '@/features/sessions/hooks/useSessionRecorder';
import { useTrayTitle } from '@/features/sessions/hooks/useTrayTitle';
import { setTrayServices, setTrayTitle } from '@/shared/tauri';

/** Everything the Homebrew module runs in the background: the services poll that
 * feeds the sidebar badge and tray, crash detection, and the menu-bar mirror.
 *
 * It exists as a component (rendering nothing) so that turning the module off
 * UNMOUNTS the work — hooks can't be called conditionally, and React Query stops
 * polling once a query has no observers. On the way out it clears the menu-bar
 * count and service menu, so the tray never keeps a stale "2/4" for a module the
 * user just switched off. */
export const HomebrewBackground = () => {
  useSeedManagedServices();
  useSessionRecorder();
  useTrayTitle();

  useEffect(
    () => () => {
      setTrayTitle('');
      setTrayServices([]);
    },
    [],
  );

  return null;
};
