import type { ITheme } from '@xterm/xterm';

const read = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/** Build an xterm theme from the live design tokens (adapts to light/dark). */
export function xtermTheme(): ITheme {
  return {
    background: read('--color-paper', '#202020'),
    foreground: read('--color-fg', '#e3e6eb'),
    cursor: read('--color-fg', '#e3e6eb'),
    cursorAccent: read('--color-paper', '#202020'),
    selectionBackground: read('--color-accent-soft', '#33415580'),
  };
}
