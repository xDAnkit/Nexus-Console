import { useEffect, type PropsWithChildren } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppSelector } from '@/shared/state/hooks';

const apply = (mode: 'light' | 'dark') => {
  const root = document.documentElement;
  // Suppress transitions for the flip frame → instant, native theme switch.
  root.classList.add('theme-switching');
  root.dataset.theme = mode;
  // Mirror for the pre-paint script in index.html (kills next-launch flash).
  try {
    localStorage.setItem('nexus-theme', mode);
  } catch {
    /* storage unavailable — flash-guard only, nothing to do */
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
};

/** Resolves settings.theme (incl. `system` via matchMedia) → data-theme on <html>. */
export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const theme = useAppSelector((s) => s.settings.theme);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => apply(theme === 'system' ? (mql.matches ? 'dark' : 'light') : theme);
    resolve();
    // Keep the native titlebar/traffic-light chrome in sync (null = follow OS).
    try {
      void getCurrentWindow().setTheme(theme === 'system' ? null : theme);
    } catch {
      /* plain-web dev: no Tauri window */
    }
    if (theme !== 'system') return;
    mql.addEventListener('change', resolve);
    return () => mql.removeEventListener('change', resolve);
  }, [theme]);

  return children;
};
