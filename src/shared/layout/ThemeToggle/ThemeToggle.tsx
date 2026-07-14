import { Sun, Moon } from 'lucide-react';
import { useAppDispatch } from '@/shared/state/hooks';
import { setTheme } from '@/shared/state/settingsSlice';
import { useResolvedTheme } from '@/shared/state/useResolvedTheme';
import { Button } from '@/shared/ui/Button';

/** Header quick toggle between light/dark (sets an explicit theme). */
export const ThemeToggle = () => {
  const dispatch = useAppDispatch();
  const isDark = useResolvedTheme() === 'dark';

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => dispatch(setTheme(isDark ? 'light' : 'dark'))}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};
