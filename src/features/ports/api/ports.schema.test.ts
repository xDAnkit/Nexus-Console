import { test, expect } from 'vitest';
import { portsSchema } from './ports.schema';

test('parses a port row', () => {
  const raw = [
    {
      pid: 99615,
      command: 'redis-server',
      user: 'ankitjain',
      port: 6379,
      proto: 'IPv4',
      cpu: 0.1,
      memoryBytes: 2211840,
    },
  ];
  expect(portsSchema.parse(raw)).toHaveLength(1);
});

test('accepts null cpu/mem', () => {
  const raw = [
    {
      pid: 1,
      command: 'launchd',
      user: 'root',
      port: 80,
      proto: 'IPv6',
      cpu: null,
      memoryBytes: null,
    },
  ];
  expect(() => portsSchema.parse(raw)).not.toThrow();
});
