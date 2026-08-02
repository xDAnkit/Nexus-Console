import type { ZodError } from 'zod';

export type IpcErrorKind =
  | 'shell'
  | 'parse'
  | 'invalidName'
  | 'forbidden'
  | 'notFound'
  | 'io'
  | 'cancelled'
  | 'busy'
  | 'contract'
  | 'unknown';

/** Normalizes both Rust `AppError` ({kind,message,detail}) and zod contract
 * failures into one shape the UI (and the query onError toast) can rely on. */
export class IpcError extends Error {
  readonly kind: IpcErrorKind;
  readonly detail?: string;

  constructor(kind: IpcErrorKind, message: string, detail?: string) {
    super(message);
    this.name = 'IpcError';
    this.kind = kind;
    this.detail = detail;
  }

  static from(e: unknown): IpcError {
    if (e && typeof e === 'object' && 'kind' in e && 'message' in e) {
      const o = e as { kind: string; message: string; detail?: string };
      return new IpcError(o.kind as IpcErrorKind, o.message, o.detail);
    }
    if (typeof e === 'string') return new IpcError('unknown', e);
    return new IpcError('unknown', e instanceof Error ? e.message : 'Unknown IPC error');
  }

  static fromZod(cmd: string, err: ZodError): IpcError {
    return new IpcError('contract', `Malformed response from "${cmd}"`, err.message);
  }
}
