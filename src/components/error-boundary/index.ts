// Main error boundary components
export {
  ErrorBoundary,
  ApplicationErrorBoundary,
  ViewErrorBoundary,
  ComponentErrorBoundary,
  type ErrorBoundaryError,
  type ErrorInfo,
  type ErrorSeverity
} from "./ErrorBoundary"

// Async error handling
export {
  AsyncErrorHandler,
  useAsyncErrorHandler,
  withAsyncErrorHandling,
  wrapAsyncFunction,
  safeInvoke,
  categorizeAsyncError,
  createAsyncError,
  type AsyncError
} from "./AsyncErrorHandler"

// Tauri-specific error handling
export {
  TauriErrorBoundary,
  withTauriErrorBoundary,
  type TauriError
} from "./TauriErrorBoundary"