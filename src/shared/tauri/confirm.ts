import { z } from 'zod';
import { ipc } from './invoke';
import { CMD } from './commands';

export interface ConfirmBulkParams {
  title: string;
  message: string;
  /** The confirm button label, e.g. "Stop all". */
  action: string;
  /** Warning (destructive) vs info styling. */
  destructive?: boolean;
}

/** Native macOS confirm (window-modal sheet on the main window) for bulk
 * actions — resolves true if confirmed, false if cancelled. Bound to the Nexus
 * window, so it never floats over another app; the caller gates on the bool. */
export const confirmBulk = ({
  title,
  message,
  action,
  destructive = false,
}: ConfirmBulkParams): Promise<boolean> =>
  ipc(CMD.CONFIRM_BULK, { title, message, action, destructive }, z.boolean());
