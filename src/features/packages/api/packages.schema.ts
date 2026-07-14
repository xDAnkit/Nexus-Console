import { z } from 'zod';

export const packageDtoSchema = z.object({
  name: z.string(),
  version: z.string(),
  kind: z.enum(['formula', 'cask']),
  outdated: z.boolean(),
  latestVersion: z.string().nullable(),
  pinned: z.boolean(),
});
export const packagesSchema = z.array(packageDtoSchema);
export type PackageDto = z.infer<typeof packageDtoSchema>;

/** Outdated status, fetched separately from the (fast) installed list. */
export const outdatedDtoSchema = z.object({
  name: z.string(),
  latestVersion: z.string().nullable(),
  pinned: z.boolean(),
});
export const outdatedSchema = z.array(outdatedDtoSchema);
export type OutdatedDto = z.infer<typeof outdatedDtoSchema>;

export const packageInfoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  version: z.string().nullable(),
  dependencies: z.array(z.string()),
  isService: z.boolean(),
  isCask: z.boolean(),
});
export type PackageInfo = z.infer<typeof packageInfoSchema>;
