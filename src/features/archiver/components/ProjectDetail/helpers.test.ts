import { describe, expect, it } from 'vitest';
import { olderThan } from './helpers';
import type { Chat } from '@/features/archiver/api/archiver.schema';

const NOW = 1_000_000_000; // seconds
const at = (daysAgo: number): Chat => ({
  file: `${daysAgo}.jsonl`,
  epoch: NOW - daysAgo * 86_400,
  title: `${daysAgo}d`,
});

describe('olderThan', () => {
  const chats = [at(0), at(3), at(10), at(40)];

  it('keeps everything when days is 0 (the "all" filter)', () => {
    expect(olderThan(chats, 0, NOW)).toHaveLength(4);
  });

  it('keeps only chats strictly older than the cutoff', () => {
    expect(olderThan(chats, 7, NOW).map((c) => c.title)).toEqual(['10d', '40d']);
    expect(olderThan(chats, 30, NOW).map((c) => c.title)).toEqual(['40d']);
  });

  it('returns empty when all chats are recent (the confusing-but-correct case)', () => {
    expect(olderThan([at(0), at(3)], 7, NOW)).toEqual([]);
  });
});
