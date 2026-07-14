import { z } from 'zod';

// Build/env config only. Machine config (brew prefix) comes from Rust in P1;
// user settings live in tauri-store. Validate once here, read `env.*` everywhere.
const schema = z.object({
  MODE: z.enum(['development', 'production', 'test']),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  VITE_POLL_MS_DEFAULT: z.coerce.number().int().positive().default(4000),
  VITE_PTY_CAP: z.coerce.number().int().positive().default(6),
});

export const env = schema.parse(import.meta.env);
export type Env = z.infer<typeof schema>;
