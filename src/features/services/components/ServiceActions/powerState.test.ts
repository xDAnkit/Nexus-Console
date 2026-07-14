import { test, expect } from 'vitest';
import { powerState } from './powerState';

test('stopped → Start, no loader, enabled', () => {
  expect(powerState('stopped', false, false)).toEqual({
    face: 'start',
    loading: false,
    disabled: false,
  });
});

test('running → Stop, no loader, enabled', () => {
  expect(powerState('running', false, false)).toEqual({
    face: 'stop',
    loading: false,
    disabled: false,
  });
});

test('start command running → Start face with loader, disabled', () => {
  // The click just happened; brew start is executing. Loader shows on Start.
  expect(powerState('starting', true, false)).toEqual({
    face: 'start',
    loading: true,
    disabled: true,
  });
});

test('started but not yet healthy → Stop face with loader, still abortable', () => {
  // Command returned; service is coming up (no listening port yet). Keep the
  // loader but let the user Stop a slow/stuck start.
  expect(powerState('starting', false, false)).toEqual({
    face: 'stop',
    loading: true,
    disabled: false,
  });
});

test('stop command running → Stop face with loader, disabled', () => {
  expect(powerState('running', false, true)).toEqual({
    face: 'stop',
    loading: true,
    disabled: true,
  });
});

test('the click→loader→Stop sequence never skips the loader', () => {
  // stopped → (click, brew running) → (coming up) → running
  const seq = [
    powerState('stopped', false, false),
    powerState('starting', true, false),
    powerState('starting', false, false),
    powerState('running', false, false),
  ];
  expect(seq.map((s) => s.loading)).toEqual([false, true, true, false]);
  expect(seq.map((s) => s.face)).toEqual(['start', 'start', 'stop', 'stop']);
});
