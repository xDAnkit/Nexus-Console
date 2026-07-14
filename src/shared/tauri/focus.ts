import { focusManager } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Route React Query's focus signal through Tauri's real window focus. WKWebView
 * doesn't fire DOM focus/visibility reliably, so refetchInterval + refetchOnWindowFocus
 * would otherwise misfire. Call once at startup. */
export function bindFocusManager(): void {
  focusManager.setEventListener((handleFocus) => {
    try {
      const win = getCurrentWindow();
      void win
        .isFocused()
        .then((f) => handleFocus(f))
        .catch(() => handleFocus(true));
      const unlisten = win.onFocusChanged(({ payload }) => handleFocus(payload));
      return () => void unlisten.then((u) => u());
    } catch {
      // Non-Tauri (plain web dev): assume focused.
      handleFocus(true);
      return () => {};
    }
  });
}
