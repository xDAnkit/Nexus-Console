import type { Chat } from '@/features/archiver/api/archiver.schema';

const DAY_SECONDS = 86_400;

/** Live-list age filter: keep chats older than `days` (chat.epoch is seconds).
 * `days === 0` (the "all" case) keeps everything. Older-than matches the "d+"
 * labels and the archive-old-chats use case. */
export const olderThan = (chats: Chat[], days: number, nowSeconds: number): Chat[] =>
  days <= 0 ? chats : chats.filter((c) => nowSeconds - c.epoch > days * DAY_SECONDS);
