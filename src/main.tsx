import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app/providers';
import { App } from '@/app/App';
import { bindFocusManager, showMainWindow } from '@/shared/tauri';
import '@/styles/index.css';

// Pause React Query polling when the window is hidden/blurred.
bindFocusManager();

// Suppress the default WKWebView context menu ("Reload", "Inspect Element", …)
// everywhere except text the user can actually select/copy (inputs, terminal
// output) — matches the `.selectable` opt-in in index.css.
window.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('input, textarea, [contenteditable="true"], .selectable')) {
    e.preventDefault();
  }
});

// Dead-man switch: the window launches hidden and Bootstrap reveals it — if
// anything crashes before that seam, force-show so the app can't stay invisible.
setTimeout(() => void showMainWindow(), 5000);

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
