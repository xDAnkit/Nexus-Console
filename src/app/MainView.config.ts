import { lazy, type ComponentType } from 'react';
import type { Tab } from '@/shared/state/uiSlice';

// Lazy pages. `.then(m => ({ default }))` keeps named exports (no default export
// in feature code) while satisfying React.lazy's default-import contract.
export const PAGES: Record<Tab, ComponentType> = {
  services: lazy(() => import('@/features/services').then((m) => ({ default: m.ServicesPage }))),
  packages: lazy(() => import('@/features/packages').then((m) => ({ default: m.PackagesPage }))),
  ports: lazy(() => import('@/features/ports').then((m) => ({ default: m.PortsPage }))),
  sessions: lazy(() => import('@/features/sessions').then((m) => ({ default: m.SessionsPage }))),
  settings: lazy(() => import('@/features/settings').then((m) => ({ default: m.SettingsPage }))),
};
