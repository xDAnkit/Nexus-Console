import { z } from 'zod';

export const portDtoSchema = z.object({
  pid: z.number(),
  command: z.string(),
  user: z.string(),
  port: z.number(),
  proto: z.string(),
  cpu: z.number().nullable(),
  memoryBytes: z.number().nullable(),
});
export const portsSchema = z.array(portDtoSchema);
export type PortDto = z.infer<typeof portDtoSchema>;
