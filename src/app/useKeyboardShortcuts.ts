import { useEffect } from 'react';
import { useAppDispatch } from '@/shared/state/hooks';
import { setActiveTab, type Tab } from '@/shared/state/uiSlice';

const TAB_KEYS: Record<string, Tab> = {
  '1': 'services',
  '2': 'packages',
  '3': 'ports',
  '4': 'sessions',
  '5': 'settings',
};

/** Global macOS-style shortcuts: Cmd+1..5 switch tabs, Cmd+, opens Settings (the
 * standard "Preferences" shortcut — an alias for Cmd+5), Cmd+F focuses the
 * active tab's search/filter input, if it has one (marked `data-nx-page-search`;
 * Sessions/Settings have none, so Cmd+F is a no-op there). */
export function useKeyboardShortcuts(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.ctrlKey) return;

      const tab = TAB_KEYS[e.key];
      if (tab) {
        e.preventDefault();
        dispatch(setActiveTab(tab));
        return;
      }
      if (e.key === ',') {
        e.preventDefault();
        dispatch(setActiveTab('settings'));
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        const input = document.querySelector<HTMLInputElement>('[data-nx-page-search]');
        if (!input) return;
        e.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
