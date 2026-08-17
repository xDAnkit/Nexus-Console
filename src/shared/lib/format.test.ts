import { test, expect } from 'vitest';
import { bareFormula, formatRelative, formulaDisplayName } from './format';

const now = 1_784_298_765_000;
const days = (n: number) => now - n * 86_400_000;

test('relative time buckets', () => {
  expect(formatRelative(now - 2 * 60_000, now)).toBe('just now');
  expect(formatRelative(now - 5 * 3_600_000, now)).toBe('5h ago');
  expect(formatRelative(days(1), now)).toBe('yesterday');
  expect(formatRelative(days(3), now)).toBe('3 days ago');
  expect(formatRelative(days(21), now)).toBe('3 weeks ago');
  expect(formatRelative(days(120), now)).toBe('4 months ago');
});

test('bareFormula: drops the tap prefix, keeps the version', () => {
  expect(bareFormula('user/repo/thing@1.2')).toBe('thing@1.2');
  expect(bareFormula('redis')).toBe('redis');
});

test('formulaDisplayName: tap-qualified formula reads as a plain name', () => {
  expect(formulaDisplayName('user/repo/some-service@1.2')).toBe('Some Service');
});
