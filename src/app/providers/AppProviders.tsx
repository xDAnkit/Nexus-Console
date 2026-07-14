import { type PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { store } from '@/app/store';
import { queryClient } from '@/app/queryClient';
import { ThemeProvider } from './ThemeProvider';
import { RootErrorBoundary } from './RootErrorBoundary';

export const AppProviders = ({ children }: PropsWithChildren) => (
  <ReduxProvider store={store}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Tooltip.Provider delayDuration={200}>
          <RootErrorBoundary>{children}</RootErrorBoundary>
          <Toaster position="bottom-right" closeButton richColors />
        </Tooltip.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  </ReduxProvider>
);
