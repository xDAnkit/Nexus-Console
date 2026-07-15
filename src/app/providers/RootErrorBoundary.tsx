import { Component, type ErrorInfo, type ReactNode } from 'react';
import { showMainWindow } from '@/shared/tauri';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// ponytail: minimal boundary for P0. Swap to react-error-boundary in P8 when
// per-feature boundaries + QueryErrorResetBoundary reset land.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Nexus Console crashed:', error, info);
    // A crash before Bootstrap's reveal must never leave the window invisible.
    void showMainWindow();
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-lg font-semibold text-fg">Something went wrong</p>
          <p className="text-sm text-fg-muted">{error.message}</p>
          <button
            type="button"
            className="mt-2 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
