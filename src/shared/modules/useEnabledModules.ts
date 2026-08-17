import { useAppSelector } from '@/shared/state/hooks';
import {
  ALL_MODULES,
  availableModules,
  isModuleAvailable,
  visibleNav,
  visibleTabs,
} from './selectors';
import { type ModuleId, type NavEntry } from './modules.config';
import { useClaudeInstalled } from './useClaudeInstalled';
import type { Tab } from '@/shared/state/uiSlice';

/** The user's choice, before machine availability. `null` (never chosen) reads as
 * everything on, so the app is fully usable while the first-run picker decides. */
export function useEnabledModules(): ModuleId[] {
  return useAppSelector((s) => s.settings.enabledModules) ?? ALL_MODULES;
}

export function useModuleEnabled(id: ModuleId): boolean {
  return useEnabledModules().includes(id);
}

export function useModuleAvailable(id: ModuleId): boolean {
  return isModuleAvailable(id, { claudeInstalled: useClaudeInstalled() });
}

function useEffectiveModules(): ModuleId[] {
  return availableModules(useEnabledModules(), { claudeInstalled: useClaudeInstalled() });
}

export function useVisibleNav(): NavEntry[] {
  return visibleNav(useEffectiveModules());
}

export function useVisibleTabs(): Tab[] {
  return visibleTabs(useEffectiveModules());
}
