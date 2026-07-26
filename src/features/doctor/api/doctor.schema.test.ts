import { test, expect } from 'vitest';
import { findingsSchema } from './doctor.schema';

const finding = {
  probeId: 'disk_free',
  scope: 'disk',
  severity: 'green',
  tag: 'storage',
  summary: '177 GB free on /',
  explain: 'Plenty of headroom.',
  guide: null,
  fix: null,
};

test('parses a finding', () => {
  expect(findingsSchema.parse([finding])).toHaveLength(1);
});

test('accepts guide steps', () => {
  const withGuide = { ...finding, guide: ['Open System Settings', 'Battery → Low Power Mode'] };
  expect(() => findingsSchema.parse([withGuide])).not.toThrow();
});

test('accepts a fix id', () => {
  const withFix = { ...finding, severity: 'yellow', fix: 'vscode_vacuum' };
  expect(() => findingsSchema.parse([withFix])).not.toThrow();
});

test('rejects an unknown severity', () => {
  expect(() => findingsSchema.parse([{ ...finding, severity: 'orange' }])).toThrow();
});
