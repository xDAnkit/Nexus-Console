import { useEffect, useState } from 'react';
import { useAppSelector } from './hooks';

/** The actually-applied theme (resolves `system` reactively via matchMedia). */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useAppSelector((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);

  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
