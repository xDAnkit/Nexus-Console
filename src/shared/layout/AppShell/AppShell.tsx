import type { PropsWithChildren, ReactNode } from 'react';
import { Sidebar } from '@/shared/layout/Sidebar';
import { ActivityBar } from '@/shared/layout/ActivityBar';

interface AppShellProps {
  /** Bottom slot (the terminal drawer) — passed in so shared/ doesn't import a feature. */
  footer?: ReactNode;
}

export const AppShell = ({ children, footer }: PropsWithChildren<AppShellProps>) => (
  <div className="flex h-screen w-screen overflow-hidden bg-canvas text-fg">
    <Sidebar />
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Overlay titlebar means the window draws no native drag region of its
          own — this thin strip is what makes the main column draggable. */}
      <div data-tauri-drag-region className="h-7 w-full shrink-0" />
      {/* The activity pill is positioned against this box (never in the flex
          flow — see ActivityBar) so starting a service can't shift the page.
          It sits above the footer/drawer and is visible on every tab, since a
          brew install started on Packages still matters while you're on Services. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {children}
        <ActivityBar />
      </div>
      {footer}
    </main>
  </div>
);
