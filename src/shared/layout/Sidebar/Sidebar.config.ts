import { LayoutGrid, Network, Clock, Settings, type LucideIcon } from 'lucide-react';
import type { Tab } from '@/shared/state/uiSlice';

export interface NavItem {
  tab: Tab;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { tab: 'services', label: 'Services', icon: LayoutGrid },
  // { tab: 'packages', label: 'Packages', icon: Package },
  { tab: 'ports', label: 'Ports', icon: Network },
  { tab: 'sessions', label: 'Sessions', icon: Clock },
  { tab: 'settings', label: 'Settings', icon: Settings },
];
