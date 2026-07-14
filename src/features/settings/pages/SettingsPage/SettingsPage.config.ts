import type { ThemeMode, Layout } from '@/shared/state/settingsSlice';
import type { SegmentOption } from '@/shared/ui/SegmentedControl';

export const THEME_OPTIONS: SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export const LAYOUT_OPTIONS: SegmentOption<Layout>[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
];
