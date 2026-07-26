import { useRef, useState } from 'react';
import { ipc, ipcVoid, CMD, IpcError, useIpcEvent } from '@/shared/tauri';
import {
  DOCTOR_FINDING_EVENT,
  DOCTOR_PROGRESS_EVENT,
  findingsSchema,
  progressSchema,
  type DoctorFinding,
  type DoctorProgress,
  type DoctorScope,
} from './doctor.schema';

/** One scan: reset → findings stream in per-probe via `doctor://finding` →
 * settle on the command's validated, severity-sorted report when it resolves.
 * User-triggered (no polling), so plain state beats React Query here. */
export function useDoctorScan() {
  const [findings, setFindings] = useState<DoctorFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [deepScanning, setDeepScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DoctorProgress | null>(null);
  // Backend cancel is cooperative (polled between `du` calls) so it can lag a
  // measurement. The scan is strictly read-only, so the UI doesn't wait: this
  // flag lets Cancel drop the running scan instantly and ignore any findings
  // the abandoned scan is still emitting.
  const aborted = useRef(false);

  useIpcEvent<unknown>(DOCTOR_FINDING_EVENT, (event) => {
    if (aborted.current) return;
    const parsed = findingsSchema.safeParse(event.payload);
    if (parsed.success) setFindings((prev) => [...prev, ...parsed.data]);
  });

  useIpcEvent<unknown>(DOCTOR_PROGRESS_EVENT, (event) => {
    if (aborted.current) return;
    const parsed = progressSchema.safeParse(event.payload);
    if (parsed.success) setProgress(parsed.data);
  });

  const scan = async (scopes: DoctorScope[]) => {
    aborted.current = false;
    setScanning(true);
    setError(null);
    setFindings([]);
    try {
      const report = await ipc(CMD.DOCTOR_SCAN, { scopes }, findingsSchema);
      if (aborted.current) return; // cancelled mid-flight — discard results
      setFindings(report);
      setHasScanned(true);
    } catch (e) {
      if (!aborted.current) setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      if (!aborted.current) setScanning(false);
    }
  };

  /** Deep scan = the full quick scan PLUS the slow sweep — one complete
   * report, so it replaces whatever was on screen (same as scan). */
  const deepScan = async () => {
    aborted.current = false;
    setDeepScanning(true);
    setError(null);
    setFindings([]);
    setProgress(null);
    try {
      const report = await ipc(CMD.DOCTOR_DEEP_SCAN, undefined, findingsSchema);
      if (aborted.current) return; // cancelled mid-flight — discard results
      setFindings(report);
      setHasScanned(true);
    } catch (e) {
      // A user cancel is not an error — just settle back quietly.
      if (!aborted.current && !(e instanceof IpcError && e.kind === 'cancelled')) {
        setError(e instanceof Error ? e.message : 'Deep scan failed');
      }
    } finally {
      if (!aborted.current) setDeepScanning(false);
      setProgress(null);
    }
  };

  /** Quick scan is read-only and has no backend cancel token (probes are fast),
   * so we just abandon it on the FE: flip `aborted` so the still-running probes'
   * findings are ignored, and drop back to the clean start screen — same feel as
   * cancelling a deep scan. */
  const cancelScan = () => {
    aborted.current = true;
    setScanning(false);
    setFindings([]);
    setHasScanned(false);
  };

  /** Read-only scan, so we don't wait for the backend to unwind: leave the
   * scanning state now (instant feedback) and fire the flag so the native side
   * stops at its next `du`. Back to the clean start screen. */
  const cancelDeepScan = () => {
    aborted.current = true;
    setDeepScanning(false);
    setProgress(null);
    setFindings([]);
    setHasScanned(false);
    void ipcVoid(CMD.DOCTOR_CANCEL_DEEP_SCAN);
  };

  return {
    findings,
    scanning,
    deepScanning,
    hasScanned,
    error,
    progress,
    scan,
    deepScan,
    cancelScan,
    cancelDeepScan,
  };
}
