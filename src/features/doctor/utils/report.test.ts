import { test, expect } from 'vitest';
import { buildReport } from './report';
import type { DoctorFinding } from '@/features/doctor/api/doctor.schema';

const finding = (over: Partial<DoctorFinding>): DoctorFinding => ({
  probeId: 'p',
  scope: 'system',
  severity: 'green',
  tag: 'speed',
  summary: 's',
  explain: 'e',
  guide: null,
  fix: null,
  ...over,
});

test('splits attention vs healthy and sorts red first', () => {
  const md = buildReport(
    [
      finding({ severity: 'green', summary: 'all good' }),
      finding({ severity: 'yellow', summary: 'meh', tag: 'storage' }),
      finding({ severity: 'red', summary: 'bad', explain: 'why it matters' }),
    ],
    'Jul 17 at 07:45 PM',
  );
  expect(md).toContain('# Nexus Doctor report — Jul 17 at 07:45 PM');
  expect(md).toContain('## Needs attention (2)');
  expect(md).toContain('## Healthy (1)');
  expect(md.indexOf('bad')).toBeLessThan(md.indexOf('meh'));
  expect(md).toContain('**[Storage]** meh');
  expect(md).toContain('  why it matters');
});

test('empty attention section stays honest', () => {
  const md = buildReport([finding({})], 'now');
  expect(md).toContain('## Needs attention (0)');
  expect(md).toContain('- Nothing — all clear.');
});
