import { test, expect } from 'vitest';
import { mapStatus, reconcile } from './reconcile';
import type { ServiceDto } from './schemas';

const dto = (over: Partial<ServiceDto>): ServiceDto => ({
  name: 'redis',
  status: 'started',
  pid: 1,
  cpu: 0,
  memoryBytes: 0,
  uptimeSecs: 0,
  port: 6379,
  healthy: true,
  plist: null,
  ...over,
});

test('mapStatus: started + healthy → running', () => {
  expect(mapStatus(dto({ status: 'started', healthy: true }))).toBe('running');
});

test('mapStatus: started + unreachable → starting (not green)', () => {
  expect(mapStatus(dto({ status: 'started', healthy: false }))).toBe('starting');
});

test('mapStatus: none/stopped → stopped', () => {
  expect(mapStatus(dto({ status: 'none' }))).toBe('stopped');
  expect(mapStatus(dto({ status: 'stopped' }))).toBe('stopped');
});

test('mapStatus: missing dto → notInstalled', () => {
  expect(mapStatus(undefined)).toBe('notInstalled');
});

test('reconcile: managed formula absent from brew → notInstalled + unlinked', () => {
  const [row] = reconcile([{ formula: 'nginx', displayName: 'Nginx' }], [], {});
  expect(row.status).toBe('notInstalled');
  expect(row.linkState).toBe('unlinked');
});

test('reconcile: intent overrides the unlinked default', () => {
  const [row] = reconcile([{ formula: 'redis', displayName: 'Redis' }], [dto({})], {
    redis: 'linked',
  });
  expect(row.status).toBe('running');
  expect(row.linkState).toBe('linked');
});

test("reconcile: tap-qualified managed formula matches brew's bare name", () => {
  const [row] = reconcile(
    [{ formula: 'mongodb/brew/mongodb-community@7.0', displayName: 'Mongodb Community' }],
    [dto({ name: 'mongodb-community@7.0', status: 'started', healthy: true })],
    {},
  );
  expect(row.status).toBe('running');
});
