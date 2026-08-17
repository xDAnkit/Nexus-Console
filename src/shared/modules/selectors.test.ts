import { test, expect } from 'vitest';
import { settingsReducer, setEnabledModules } from '@/shared/state/settingsSlice';
import { ALL_MODULES, isTabVisible, sanitizeModules, visibleTabs } from './selectors';

test('visibleTabs: only the enabled modules, registry order, Settings last', () => {
  expect(visibleTabs(['claude'])).toEqual(['archiver', 'settings']);
  expect(visibleTabs(['homebrew'])).toEqual(['services', 'packages', 'sessions', 'settings']);
  // Order comes from the registry, not from the order the user picked.
  expect(visibleTabs(['claude', 'homebrew'])).toEqual([
    'services',
    'packages',
    'sessions',
    'archiver',
    'settings',
  ]);
});

test('isTabVisible: Settings is reachable however the rest is configured', () => {
  expect(isTabVisible('settings', ['ports'])).toBe(true);
  expect(isTabVisible('services', ['ports'])).toBe(false);
});

test('sanitizeModules: no persisted settings → null (first run)', () => {
  expect(sanitizeModules(undefined, false)).toBeNull();
});

test('sanitizeModules: existing install without the key → everything on', () => {
  expect(sanitizeModules(undefined, true)).toEqual(ALL_MODULES);
});

test('sanitizeModules: unknown ids are dropped, order normalized', () => {
  expect(sanitizeModules(['claude', 'nope', 'ports'], true)).toEqual(['ports', 'claude']);
});

test('sanitizeModules: garbage or empty fails OPEN, never a tabless window', () => {
  expect(sanitizeModules([], true)).toEqual(ALL_MODULES);
  expect(sanitizeModules(['nope'], true)).toEqual(ALL_MODULES);
  expect(sanitizeModules('homebrew', true)).toEqual(ALL_MODULES);
  expect(sanitizeModules({ homebrew: true }, true)).toEqual(ALL_MODULES);
});

test('setEnabledModules: normalizes order and drops unknown ids', () => {
  const state = settingsReducer(undefined, setEnabledModules(['claude', 'homebrew']));
  expect(state.enabledModules).toEqual(['homebrew', 'claude']);
});

test('setEnabledModules: emptying the list is a no-op (last module can never go)', () => {
  const one = settingsReducer(undefined, setEnabledModules(['doctor']));
  const still = settingsReducer(one, setEnabledModules([]));
  expect(still.enabledModules).toEqual(['doctor']);
});
