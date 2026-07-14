import { test, expect } from 'vitest';
import { applyCardOrder, mergeVisibleOrder } from './cardOrder';

const svc = (formula: string) => ({ formula });

test('applyCardOrder: empty order keeps natural order', () => {
  const items = [svc('a'), svc('b')];
  expect(applyCardOrder(items, [])).toBe(items);
});

test('applyCardOrder: sorts by order, unknown formulas last in natural order', () => {
  const items = [svc('a'), svc('b'), svc('c'), svc('new')];
  expect(applyCardOrder(items, ['c', 'a', 'b']).map((s) => s.formula)).toEqual([
    'c',
    'a',
    'b',
    'new',
  ]);
});

test('mergeVisibleOrder: reordered visible cards splice back, hidden ones stay put', () => {
  // Full order a,b,c,d; b filtered out; user drags visible to [d, a, c].
  // Visible slots (positions of a,c,d) refill in sequence; b's slot is untouched.
  const full = [svc('a'), svc('b'), svc('c'), svc('d')];
  expect(mergeVisibleOrder(full, ['d', 'a', 'c'])).toEqual(['d', 'b', 'a', 'c']);
});

test('mergeVisibleOrder: no filter → visible order wins outright', () => {
  const full = [svc('a'), svc('b'), svc('c')];
  expect(mergeVisibleOrder(full, ['c', 'b', 'a'])).toEqual(['c', 'b', 'a']);
});
