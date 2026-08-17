import { Settings } from 'lucide-react';
import type { Tab } from '@/shared/state/uiSlice';
import { MODULES, MODULE_IDS, type ModuleId, type NavEntry } from './modules.config';

export const ALL_MODULES: ModuleId[] = [...MODULE_IDS];

/** Belongs to no module on purpose — Settings stays reachable however the rest
 * is configured, so a bad choice is always recoverable from inside the app. */
const SETTINGS_NAV: NavEntry = { tab: 'settings', label: 'Settings', icon: Settings };

/** Sidebar nav for the enabled modules, in registry order, Settings last. */
export function visibleNav(enabled: ModuleId[]): NavEntry[] {
  const owned = MODULES.filter((m) => enabled.includes(m.id)).flatMap((m) => m.nav);
  return [...owned, SETTINGS_NAV];
}

export function visibleTabs(enabled: ModuleId[]): Tab[] {
  return visibleNav(enabled).map((n) => n.tab);
}

export function isTabVisible(tab: Tab, enabled: ModuleId[]): boolean {
  return visibleTabs(enabled).includes(tab);
}

/** Does this Mac have what the module needs? See ModuleRequirement for why only
 * Claude Code counts. */
export function isModuleAvailable(id: ModuleId, deps: { claudeInstalled: boolean }): boolean {
  return MODULES.find((m) => m.id === id)?.requires === 'claude' ? deps.claudeInstalled : true;
}

/** Enabled AND available — what the sidebar and the router go by. */
export function availableModules(
  enabled: ModuleId[],
  deps: { claudeInstalled: boolean },
): ModuleId[] {
  return enabled.filter((id) => isModuleAvailable(id, deps));
}

/** Normalize the module list read off disk. `settings.json` is user-editable, so
 * this is a trust boundary — and the one place in the app that fails OPEN:
 * failing closed here would render a window with no tabs, which no user could
 * recover from. Unknown ids are dropped (a renamed module can never brick the
 * app) and the result is put back in registry order.
 *
 * `hasPersistedSettings` distinguishes "never chosen" (→ null, show the first-run
 * screen) from "existing install, key not written yet" (→ everything on, no
 * onboarding wall for someone mid-flow). */
export function sanitizeModules(raw: unknown, hasPersistedSettings: boolean): ModuleId[] | null {
  if (!Array.isArray(raw)) return hasPersistedSettings ? [...ALL_MODULES] : null;
  const known = MODULE_IDS.filter((id) => raw.includes(id));
  return known.length > 0 ? known : [...ALL_MODULES];
}
