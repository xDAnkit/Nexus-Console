import type { PropsWithChildren, ReactNode } from 'react';
import { Sidebar } from '@/shared/layout/Sidebar';

interface AppShellProps {
  /** Bottom slot (the terminal drawer) — passed in so shared/ doesn't import a feature. */
  footer?: ReactNode;
}

export const AppShell = ({ children, footer }: PropsWithChildren<AppShellProps>) => (
  <div className="flex h-screen w-screen overflow-hidden bg-canvas text-fg">
    <Sidebar />
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {footer}
    </main>
  </div>
);
