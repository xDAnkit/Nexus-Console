export {
  MODULES,
  MODULE_IDS,
  moduleById,
  type ModuleDef,
  type ModuleId,
  type ModuleRequirement,
  type NavEntry,
} from './modules.config';
export {
  ALL_MODULES,
  availableModules,
  isModuleAvailable,
  isTabVisible,
  sanitizeModules,
  visibleNav,
  visibleTabs,
} from './selectors';
export {
  useEnabledModules,
  useModuleAvailable,
  useModuleEnabled,
  useVisibleNav,
  useVisibleTabs,
} from './useEnabledModules';
export { useClaudeInstalled } from './useClaudeInstalled';
