import { invoke } from '@tauri-apps/api/core';
import type { ZodType } from 'zod';
import { IpcError } from './ipc-error';

/** The one typed IPC entry point: invoke a Rust command and zod-validate its
 * result at the trust boundary. Only this module talks to @tauri-apps/api. */
export async function ipc<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await invoke(cmd, args);
  } catch (e) {
    throw IpcError.from(e);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw IpcError.fromZod(cmd, parsed.error);
  }
  return parsed.data;
}

/** For commands that return nothing (mutations). No result to validate. */
export async function ipcVoid(cmd: string, args?: Record<string, unknown>): Promise<void> {
  try {
    await invoke(cmd, args);
  } catch (e) {
    throw IpcError.from(e);
  }
}
