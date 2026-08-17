import {
  Archive,
  Clock,
  LayoutGrid,
  Network,
  Package,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from '@/shared/state/uiSlice';

/** The four things this app actually is. Order is nav order. */
export const MODULE_IDS = ['homebrew', 'ports', 'doctor', 'claude'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** What a module needs on this Mac to be offered at all. Only Claude Code
 * qualifies: without it the module has nothing to show. Homebrew is deliberately
 * NOT a requirement — it can be installed later, and the Homebrew pages already
 * carry a "not detected" state that says how, which beats hiding the app's core
 * (and leaving a near-empty window). */
export type ModuleRequirement = 'claude';

export interface NavEntry {
  tab: Tab;
  label: string;
  icon: LucideIcon;
}

export interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  /** The tabs this module owns, in nav order. */
  nav: NavEntry[];
  /** One line: what you get. */
  blurb: string;
  /** One line: what runs while it's on. null = nothing in the background. */
  background: string | null;
  requires?: ModuleRequirement;
}

/** THE registry — the sidebar, the first-run screen and Settings → Features are
 * all derived from this array. Nothing else may define which tabs exist.
 * `settings` deliberately belongs to no module: it must stay reachable however
 * the rest is configured (see visibleNav). */
export const MODULES: ModuleDef[] = [
  {
    id: 'homebrew',
    label: 'Homebrew',
    icon: LayoutGrid,
    nav: [
      { tab: 'services', label: 'Services', icon: LayoutGrid },
      { tab: 'packages', label: 'Packages', icon: Package },
      { tab: 'sessions', label: 'Sessions', icon: Clock },
    ],
    blurb: 'Services, packages and versions.',
    background: 'Checks Homebrew every few seconds and keeps the menu-bar count live.',
  },
  {
    id: 'ports',
    label: 'Ports',
    icon: Network,
    nav: [{ tab: 'ports', label: 'Ports', icon: Network }],
    blurb: "See what's listening, kill what's stuck.",
    background: null,
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    nav: [{ tab: 'doctor', label: 'Doctor', icon: Stethoscope }],
    blurb: 'Read-only machine health checks and cleanup.',
    background: 'Optional daily VSCode cleanup while the app sits in the tray.',
  },
  {
    id: 'claude',
    label: 'Claude Chats',
    icon: Archive,
    nav: [{ tab: 'archiver', label: 'Claude Chats', icon: Archive }],
    blurb: 'Browse and archive your Claude Code history.',
    background: 'Optional daily chat archiving while the app sits in the tray.',
    requires: 'claude',
  },
];

export const moduleById = (id: ModuleId): ModuleDef =>
  MODULES.find((m) => m.id === id) ?? MODULES[0];
