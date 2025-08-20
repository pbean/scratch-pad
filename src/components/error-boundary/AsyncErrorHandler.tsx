import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useToast } from "../ui/toast"
import type { 
  CategorizedError, 
  TypeSafeErrorHandler, 
  ErrorReportingConfig 
} from "../../types/middleware"

// ============================================================================
// TYPE-SAFE ASYNC ERROR HANDLING
// ============================================================================

/**
 * Enhanced async error interface with complete type safety
 */
export interface TypeSafeAsyncError {
  type: CategorizedError['category']
  subtype: CategorizedError['subtype']
  originalError: unknown
  message: string
  stack?: string
  timestamp: number
  errorId: string
  userAgent?: string
  url?: string
  context?: Record<string, unknown>
}

export interface AsyncErrorHandlerProps {
  onError?: TypeSafeErrorHandler
  config?: Partial<ErrorReportingConfig>
  enableToast?: boolean
  enableReporting?: boolean
}

/**
 * Global async error tracking with type safety
 */
class TypeSafeAsyncErrorTracker {
  private static instance: TypeSafeAsyncErrorTracker
  private errors: Map<string, TypeSafeAsyncError> = new Map()
  private listeners: Set<TypeSafeErrorHandler> = new Set()
  private readonly maxErrors = 100

  static getInstance(): TypeSafeAsyncErrorTracker {
    if (!TypeSafeAsyncErrorTracker.instance) {
      TypeSafeAsyncErrorTracker.instance = new TypeSafeAsyncErrorTracker()
    }
    return TypeSafeAsyncErrorTracker.instance
  }

  addListener(listener: TypeSafeErrorHandler): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  reportError(error: TypeSafeAsyncError): void {
    // Limit memory usage by removing old errors
    if (this.errors.size >= this.maxErrors) {
      const oldestKey = this.errors.keys().next().value
      if (oldestKey) {
        this.errors.delete(oldestKey)
      }
    }
    
    this.errors.set(error.errorId, error)
    
    // Notify listeners with categorized error
    const categorizedError: CategorizedError = {
      category: error.type,
      subtype: error.subtype,
      originalError: error.originalError
    } as CategorizedError
    
    this.listeners.forEach(listener => {
      try {
        listener(categorizedError)
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError)
      }
    })
  }

  getRecentErrors(count = 10): TypeSafeAsyncError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
  }

  clearErrors(): void {
    this.errors.clear()
  }

  getErrorStats(): { total: number; byType: Record<string, number> } {
    const total = this.errors.size
    const byType: Record<string, number> = {}
    
    for (const error of this.errors.values()) {
      const key = `${error.type}:${error.subtype}`
      byType[key] = (byType[key] || 0) + 1
    }
    
    return { total, byType }
  }
}

// ============================================================================
// ERROR CATEGORIZATION WITH TYPE SAFETY
// ============================================================================

/**
 * Type-safe error categorization
 */
export function categorizeAsyncErrorTypeSafe(error: unknown): Pick<CategorizedError, 'category' | 'subtype'> {
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()
    
    // Tauri-specific errors
    if (message.includes("tauri") || message.includes("failed to invoke") || name.includes("tauri")) {
      if (message.includes("window not found") || message.includes("window")) {
        return { category: 'tauri', subtype: 'window_error' }
      }
      if (message.includes("permission") || message.includes("denied")) {
        return { category: 'tauri', subtype: 'permission_denied' }
      }
      return { category: 'tauri', subtype: 'ipc_failure' }
    }
    
    // Network errors
    if (error instanceof TypeError && message.includes("fetch")) {
      return { category: 'network', subtype: 'fetch_error' }
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return { category: 'network', subtype: 'timeout' }
    }
    if (message.includes("network") || message.includes("connection")) {
      return { category: 'network', subtype: 'connection_lost' }
    }
    
    // Runtime errors
    if (error instanceof TypeError) {
      return { category: 'runtime', subtype: 'type_error' }
    }
    if (error instanceof ReferenceError) {
      return { category: 'runtime', subtype: 'reference_error' }
    }
    if (error instanceof SyntaxError) {
      return { category: 'runtime', subtype: 'syntax_error' }
    }
  }
  
  // Handle PromiseRejectionEvent
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>
    if (errorObj.reason || errorObj.type === 'unhandledrejection') {
      return { category: 'async', subtype: 'unhandled_rejection' }
    }
  }
  
  // String errors
  if (typeof error === 'string') {
    const message = error.toLowerCase()
    if (message.includes("promise")) {
      return { category: 'async', subtype: 'promise_error' }
    }
  }
  
  return { category: 'unknown', subtype: 'unclassified' }
}

/**
 * Create type-safe async error with enhanced context
 */
export function createTypeSafeAsyncError(
  originalError: unknown, 
  overrideCategory?: CategorizedError['category'],
  overrideSubtype?: CategorizedError['subtype'],
  context?: Record<string, unknown>
): TypeSafeAsyncError {
  const { category, subtype } = overrideCategory && overrideSubtype 
    ? { category: overrideCategory, subtype: overrideSubtype }
    : categorizeAsyncErrorTypeSafe(originalError)
    
  const errorId = `async_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  let message = "An unexpected error occurred"
  let stack: string | undefined
  
  // Extract message and stack safely
  if (originalError instanceof Error) {
    message = originalError.message
    stack = originalError.stack
  } else if (typeof originalError === "string") {
    message = originalError
  } else if (typeof originalError === "object" && originalError !== null) {
    const errorObj = originalError as Record<string, unknown>
    if (typeof errorObj.message === "string") {
      message = errorObj.message
    } else if (typeof errorObj.reason === "object" && errorObj.reason !== null) {
      const reason = errorObj.reason as Record<string, unknown>
      if (typeof reason.message === "string") {
        message = reason.message
      }
    }
  }

  // Clean up messages for user display
  message = cleanErrorMessage(message, category, subtype)

  return {
    type: category,
    subtype,
    originalError,
    message,
    stack,
    timestamp: Date.now(),
    errorId,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    context
  }
}

/**
 * Clean error messages for user-friendly display
 */
function cleanErrorMessage(
  message: string, 
  category: CategorizedError['category'],
  subtype: CategorizedError['subtype']
): string {
  // Clean up Tauri error messages
  if (category === 'tauri') {
    if (message.includes("failed to invoke")) {
      return "Failed to communicate with the application backend"
    }
    if (subtype === 'window_error') {
      return "Window operation failed"
    }
    if (subtype === 'permission_denied') {
      return "Operation not permitted"
    }
    return "Application backend error"
  }
  
  // Clean up network error messages
  if (category === 'network') {
    if (subtype === 'fetch_error') {
      return "Network request failed"
    }
    if (subtype === 'timeout') {
      return "Request timed out"
    }
    if (subtype === 'connection_lost') {
      return "Connection lost"
    }
  }
  
  // Clean up runtime error messages
  if (category === 'runtime') {
    if (subtype === 'type_error') {
      return "Type error in application code"
    }
    if (subtype === 'reference_error') {
      return "Reference error in application code"
    }
  }
  
  return message
}

// ============================================================================
// ERROR REPORTING WITH TYPE SAFETY
// ============================================================================

/**
 * Type-safe error reporting to backend
 */
async function reportTypeSafeAsyncError(
  error: TypeSafeAsyncError,
  config: ErrorReportingConfig
): Promise<void> {
  if (!config.enableBackendReporting) return
  
  try {
    await invoke("log_frontend_async_error", {
      error: {
        errorId: error.errorId,
        type: error.type,
        subtype: error.subtype,
        message: error.message,
        stack: error.stack,
        timestamp: error.timestamp,
        userAgent: error.userAgent,
        url: error.url,
        context: error.context,
        originalError: error.originalError ? JSON.stringify(error.originalError, null, 2) : null
      }
    })
  } catch (reportingError) {
    if (config.enableConsoleLogging) {
      console.error("Failed to report async error:", reportingError)
      console.error("Original error:", error)
    }
  }
}

// ============================================================================
// REACT HOOKS FOR TYPE-SAFE ERROR HANDLING
// ============================================================================

/**
 * Hook for handling async errors in components with complete type safety
 */
export function useTypeSafeAsyncErrorHandler(options: AsyncErrorHandlerProps = {}) {
  const { onError, config = {} } = options
  const toast = useToast()
  const tracker = TypeSafeAsyncErrorTracker.getInstance()
  
  const errorConfig: ErrorReportingConfig = {
    enableToast: true,
    enableBackendReporting: true,
    enableConsoleLogging: process.env.NODE_ENV === 'development',
    ...config
  }

  useEffect(() => {
    const handleError: TypeSafeErrorHandler = (categorizedError) => {
      // Apply filter if provided
      if (errorConfig.filterPredicate && !errorConfig.filterPredicate(categorizedError)) {
        return
      }
      
      // Create full error object for reporting
      const fullError = createTypeSafeAsyncError(
        categorizedError.originalError,
        categorizedError.category,
        categorizedError.subtype
      )
      
      // Report to backend if enabled
      if (errorConfig.enableBackendReporting) {
        reportTypeSafeAsyncError(fullError, errorConfig).catch(reportError => {
          if (errorConfig.enableConsoleLogging) {
            console.error("Error reporting failed:", reportError)
          }
        })
      }

      // Show toast notification if enabled and error is user-facing
      if (errorConfig.enableToast && shouldShowToast(categorizedError)) {
        toast.error("Error", fullError.message)
      }
      
      // Log to console if enabled
      if (errorConfig.enableConsoleLogging) {
        console.error("Async Error:", fullError)
      }

      // Call custom error handler
      onError?.(categorizedError)
    }

    return tracker.addListener(handleError)
  }, [onError, errorConfig, toast])

  return {
    reportError: (
      error: unknown, 
      category?: CategorizedError['category'],
      subtype?: CategorizedError['subtype'],
      context?: Record<string, unknown>
    ) => {
      const asyncError = createTypeSafeAsyncError(error, category, subtype, context)
      tracker.reportError(asyncError)
    },
    getRecentErrors: () => tracker.getRecentErrors(),
    clearErrors: () => tracker.clearErrors(),
    getErrorStats: () => tracker.getErrorStats()
  }
}

/**
 * Determine if an error should show a toast notification
 */
function shouldShowToast(error: CategorizedError): boolean {
  // Don't show toasts for development-only errors
  if (error.category === 'unknown') return false
  
  // Don't show toasts for ResizeObserver loop errors (common and harmless)
  if (error.category === 'async' && 
      typeof error.originalError === 'object' && 
      error.originalError !== null) {
    const errorObj = error.originalError as Record<string, unknown>
    const message = String(errorObj.message || '')
    if (message.includes('ResizeObserver')) return false
  }
  
  // Show toasts for user-facing errors
  return error.category === 'tauri' || 
         error.category === 'network' ||
         (error.category === 'async' && error.subtype === 'unhandled_rejection')
}

// ============================================================================
// COMPONENT AND HOC IMPLEMENTATIONS
// ============================================================================

/**
 * Component for global async error handling with type safety
 */
export function TypeSafeAsyncErrorHandler({ 
  onError, 
  config = {},
  enableToast,
  enableReporting
}: AsyncErrorHandlerProps) {
  // Support legacy props
  const effectiveConfig = {
    ...config,
    ...(enableToast !== undefined && { enableToast }),
    ...(enableReporting !== undefined && { enableBackendReporting: enableReporting })
  }
  const tracker = TypeSafeAsyncErrorTracker.getInstance()
  
  useTypeSafeAsyncErrorHandler({ onError, config: effectiveConfig })

  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault() // Prevent default console logging
      
      const error = createTypeSafeAsyncError(
        event.reason, 
        'async', 
        'unhandled_rejection',
        { 
          eventType: 'unhandledrejection',
          timeStamp: event.timeStamp 
        }
      )
      tracker.reportError(error)
    }

    // Handle general window errors (catch-all)
    const handleWindowError = (event: ErrorEvent) => {
      // Skip if this is already handled by ErrorBoundary
      if (event.error?.__handledByErrorBoundary) {
        return
      }

      const error = createTypeSafeAsyncError(
        event.error || event.message,
        'runtime',
        'type_error',
        {
          eventType: 'error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      )
      tracker.reportError(error)
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleWindowError)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleWindowError)
    }
  }, [])

  return null // This component doesn't render anything
}

/**
 * Higher-order component for wrapping components with type-safe async error handling
 */
export function withTypeSafeAsyncErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options: AsyncErrorHandlerProps = {}
) {
  return function WithTypeSafeAsyncErrorHandling(props: P) {
    useTypeSafeAsyncErrorHandler(options)
    return <Component {...props} />
  }
}

/**
 * Type-safe wrapper for async functions with error handling
 */
export function wrapTypeSafeAsyncFunction<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  category?: CategorizedError['category'],
  subtype?: CategorizedError['subtype'],
  context?: Record<string, unknown>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args)
    } catch (error) {
      const tracker = TypeSafeAsyncErrorTracker.getInstance()
      const asyncError = createTypeSafeAsyncError(error, category, subtype, context)
      tracker.reportError(asyncError)
      throw error // Re-throw so calling code can still handle it
    }
  }
}

/**
 * Type-safe wrapper for Tauri invoke calls
 */
export function safeInvokeTypeSafe<T = unknown>(
  command: string, 
  args?: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<T> {
  return wrapTypeSafeAsyncFunction(
    (cmd: string, arguments_?: Record<string, unknown>) => invoke<T>(cmd, arguments_),
    'tauri',
    'ipc_failure',
    { command, ...context }
  )(command, args)
}

// Export functions used by index.ts
export const categorizeAsyncError = categorizeAsyncErrorTypeSafe
export const createAsyncError = createTypeSafeAsyncError

// Export legacy components for backward compatibility
export type AsyncError = TypeSafeAsyncError
export const AsyncErrorHandler = TypeSafeAsyncErrorHandler
export const useAsyncErrorHandler = useTypeSafeAsyncErrorHandler
export const withAsyncErrorHandling = withTypeSafeAsyncErrorHandling
export const wrapAsyncFunction = wrapTypeSafeAsyncFunction
export const safeInvoke = safeInvokeTypeSafe