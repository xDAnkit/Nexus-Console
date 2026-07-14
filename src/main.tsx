import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app/providers';
import { App } from '@/app/App';
import { bindFocusManager } from '@/shared/tauri';
import '@/styles/index.css';

// Pause React Query polling when the window is hidden/blurred.
bindFocusManager();

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
