import { z } from 'zod';

/** Mirrors Rust `AppContext` (serde camelCase). brew* are null when Homebrew
 * isn't found. This schema is the drift guard between Rust and TS. */
export const appContextSchema = z.object({
  platform: z.string(),
  arch: z.string(),
  brewPrefix: z.string().nullable(),
  brewBin: z.string().nullable(),
  brewVersion: z.string().nullable(),
});
export type AppContext = z.infer<typeof appContextSchema>;

/** Mirrors Rust `AppError` serialization. */
export const appErrorSchema = z.object({
  kind: z.enum(['shell', 'parse', 'invalidName', 'forbidden', 'notFound', 'io']),
  message: z.string(),
  detail: z.string().optional(),
});
