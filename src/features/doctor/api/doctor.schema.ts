import { z } from 'zod';

/** Mirror of the Rust `Scope` enum — one tab per scope on the Doctor page. */
export const DOCTOR_SCOPES = ['system', 'claude', 'vscode', 'browser', 'disk', 'startup'] as const;
export type DoctorScope = (typeof DOCTOR_SCOPES)[number];

/** Streamed per-probe while a scan runs; the command's return is the full report. */
export const DOCTOR_FINDING_EVENT = 'doctor://finding';

/** Emitted before each deep-scan probe settles — drives the progress bar. */
export const DOCTOR_PROGRESS_EVENT = 'doctor://progress';

export const progressSchema = z.object({
  probeId: z.string(),
  index: z.number(),
  total: z.number(),
});
export type DoctorProgress = z.infer<typeof progressSchema>;

export const findingSchema = z.object({
  probeId: z.string(),
  scope: z.enum(DOCTOR_SCOPES),
  severity: z.enum(['red', 'yellow', 'green']),
  tag: z.enum(['speed', 'storage', 'info']),
  summary: z.string(),
  explain: z.string(),
  guide: z.array(z.string()).nullable(),
  fix: z.string().nullable(),
});
export const findingsSchema = z.array(findingSchema);
export type DoctorFinding = z.infer<typeof findingSchema>;

export const journalEntrySchema = z.object({
  tsEpoch: z.number(),
  action: z.string(),
  detail: z.string(),
});
export const journalSchema = z.array(journalEntrySchema);
export type JournalEntry = z.infer<typeof journalEntrySchema>;
