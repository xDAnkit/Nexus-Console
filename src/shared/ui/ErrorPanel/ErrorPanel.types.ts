export interface ErrorPanelProps {
  /** The thrown value from a React Query `error` — usually an `IpcError`. */
  error: unknown;
  /** Shown when the error carries no usable message of its own. */
  fallback: string;
  /** Renders a Retry button when provided. Omitted for auto-polling queries. */
  onRetry?: () => void;
}
