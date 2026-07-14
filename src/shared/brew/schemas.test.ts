import { test, expect } from 'vitest';
import { servicesSchema } from './schemas';

// Drift guard for the ServiceDto contract (Rust serde ↔ TS zod).
test('parses a running service with stats', () => {
  const raw = [
    {
      name: 'redis',
      status: 'started',
      pid: 99615,
      cpu: 0.2,
      memoryBytes: 2211840,
      uptimeSecs: 21049,
      port: 6379,
      healthy: true,
      plist: '/opt/homebrew/opt/redis/homebrew.mxcl.redis.plist',
    },
  ];
  expect(servicesSchema.parse(raw)).toHaveLength(1);
});

test('accepts nulls (stopped / no stats)', () => {
  const raw = [
    {
      name: 'nginx',
      status: 'none',
      pid: null,
      cpu: null,
      memoryBytes: null,
      uptimeSecs: null,
      port: 80,
      healthy: null,
      plist: null,
    },
  ];
  expect(() => servicesSchema.parse(raw)).not.toThrow();
});
