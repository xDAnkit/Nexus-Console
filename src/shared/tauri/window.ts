import { getCurrentWindow } from '@tauri-apps/api/window';

/** Reveal the main window (created `visible: false` so launch never white-flashes).
 * Idempotent — safe to call from the splash seam, the crash fallback, and the
 * dead-man timer. No-op in plain-web dev. */
export async function showMainWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();
  } catch {
    // Non-Tauri (plain web dev): nothing to show.
  }
}
