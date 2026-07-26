import {
  Archive,
  LayoutGrid,
  Network,
  Clock,
  Stethoscope,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from '@/shared/state/uiSlice';

export interface NavItem {
  tab: Tab;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { tab: 'services', label: 'Services', icon: LayoutGrid },
  // { tab: 'packages', label: 'Packages', icon: Package },
  { tab: 'doctor', label: 'Doctor', icon: Stethoscope },
  { tab: 'archiver', label: 'Claude Chats', icon: Archive },
  { tab: 'ports', label: 'Ports', icon: Network },
  { tab: 'sessions', label: 'Sessions', icon: Clock },
  { tab: 'settings', label: 'Settings', icon: Settings },
];
