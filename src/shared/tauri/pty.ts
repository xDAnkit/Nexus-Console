import { Channel, invoke } from '@tauri-apps/api/core';
import { ipcVoid } from './invoke';
import { CMD } from './commands';
import { IpcError } from './ipc-error';

/** Streamed from Rust — not zod-validated (high-frequency, and it's raw bytes). */
export type PtyEvent = { type: 'output'; data: string } | { type: 'exit' };

export interface PtyOpenParams {
  id: string;
  formula: string;
  kind: 'cli' | 'logs';
  cols: number;
  rows: number;
}

/** Open a PTY. Output/exit stream in over a Channel (not the ipc() path). */
export async function openPty(
  params: PtyOpenParams,
  onEvent: (e: PtyEvent) => void,
): Promise<void> {
  const channel = new Channel<PtyEvent>();
  channel.onmessage = onEvent;
  try {
    await invoke(CMD.PTY_OPEN, { ...params, onEvent: channel });
  } catch (e) {
    throw IpcError.from(e);
  }
}

export const writePty = (id: string, data: string) => ipcVoid(CMD.PTY_WRITE, { id, data });
export const resizePty = (id: string, cols: number, rows: number) =>
  ipcVoid(CMD.PTY_RESIZE, { id, cols, rows });
export const killPty = (id: string) => ipcVoid(CMD.PTY_KILL, { id });
