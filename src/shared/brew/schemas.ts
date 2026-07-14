import { z } from 'zod';

/** Mirrors Rust `ServiceDto` (serde camelCase). null when unknown/not running. */
export const serviceDtoSchema = z.object({
  name: z.string(),
  status: z.string(),
  pid: z.number().nullable(),
  cpu: z.number().nullable(),
  memoryBytes: z.number().nullable(),
  uptimeSecs: z.number().nullable(),
  port: z.number().nullable(),
  healthy: z.boolean().nullable(),
  plist: z.string().nullable(),
});
export const servicesSchema = z.array(serviceDtoSchema);
export type ServiceDto = z.infer<typeof serviceDtoSchema>;
