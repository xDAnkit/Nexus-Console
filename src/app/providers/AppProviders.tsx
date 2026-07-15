import { type PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { store } from '@/app/store';
import { queryClient } from '@/app/queryClient';
import { useResolvedTheme } from '@/shared/state/useResolvedTheme';
import { ThemeProvider } from './ThemeProvider';
import { RootErrorBoundary } from './RootErrorBoundary';

// Sonner defaults to a light theme and doesn't read the app's data-theme —
// without this, toasts render light-on-dark.
const ThemedToaster = () => (
  <Toaster position="bottom-right" closeButton richColors theme={useResolvedTheme()} />
);

export const AppProviders = ({ children }: PropsWithChildren) => (
  <ReduxProvider store={store}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Tooltip.Provider delayDuration={200}>
          <RootErrorBoundary>{children}</RootErrorBoundary>
          <ThemedToaster />
        </Tooltip.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </ReduxProvider>
);
