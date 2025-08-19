import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useToast } from "../ui/toast"

// Types for async error handling
export interface AsyncError {
  type: "unhandled_rejection" | "tauri_error" | "fetch_error" | "unknown"
  originalError: any
  message: string
  stack?: string
  timestamp: number
  errorId: string
}

interface AsyncErrorHandlerProps {
  onError?: (error: AsyncError) => void
  enableToast?: boolean
  enableReporting?: boolean
}

// Global async error tracking
class AsyncErrorTracker {
  private static instance: AsyncErrorTracker
  private errors: Map<string, AsyncError> = new Map()
  private listeners: Set<(error: AsyncError) => void> = new Set()

  static getInstance(): AsyncErrorTracker {
    if (!AsyncErrorTracker.instance) {
      AsyncErrorTracker.instance = new AsyncErrorTracker()
    }
    return AsyncErrorTracker.instance
  }

  addListener(listener: (error: AsyncError) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  reportError(error: AsyncError) {
    this.errors.set(error.errorId, error)
    this.listeners.forEach(listener => listener(error))
  }

  getRecentErrors(count = 10): AsyncError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
  }

  clearErrors() {
    this.errors.clear()
  }
}

// Utility functions for error categorization and handling
export function categorizeAsyncError(error: any): AsyncError["type"] {
  if (error?.message?.includes("tauri") || error?.code?.startsWith("TAURI")) {
    return "tauri_error"
  }
  
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "fetch_error"
  }

  if (error?.name === "UnhandledPromiseRejection" || error?.reason) {
    return "unhandled_rejection"
  }

  return "unknown"
}

export function createAsyncError(originalError: any, type?: AsyncError["type"]): AsyncError {
  const errorType = type || categorizeAsyncError(originalError)
  const errorId = `async_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  let message = "An unexpected error occurred"
  
  if (originalError?.message) {
    message = originalError.message
  } else if (typeof originalError === "string") {
    message = originalError
  } else if (originalError?.reason?.message) {
    message = originalError.reason.message
  }

  // Clean up Tauri error messages for user display
  if (errorType === "tauri_error") {
    if (message.includes("failed to invoke")) {
      message = "Failed to communicate with the application backend"
    } else if (message.includes("window not found")) {
      message = "Window operation failed"
    } else if (message.includes("permission denied")) {
      message = "Operation not permitted"
    }
  }

  return {
    type: errorType,
    originalError,
    message,
    stack: originalError?.stack,
    timestamp: Date.now(),
    errorId
  }
}

async function reportAsyncError(error: AsyncError) {
  try {
    await invoke("log_frontend_async_error", {
      error: {
        errorId: error.errorId,
        type: error.type,
        message: error.message,
        stack: error.stack,
        timestamp: error.timestamp,
        originalError: error.originalError ? JSON.stringify(error.originalError, null, 2) : null
      }
    })
  } catch (reportingError) {
    console.error("Failed to report async error:", reportingError)
    // Fallback to console
    console.error("Async Error:", error)
  }
}

// Hook for handling async errors in components
export function useAsyncErrorHandler(options: AsyncErrorHandlerProps = {}) {
  const { onError, enableToast = true, enableReporting = true } = options
  const toast = useToast()
  const tracker = AsyncErrorTracker.getInstance()

  useEffect(() => {
    const handleError = (error: AsyncError) => {
      // Report to backend if enabled
      if (enableReporting) {
        reportAsyncError(error).catch(console.error)
      }

      // Show toast notification if enabled and error is user-facing
      if (enableToast && error.type !== "unknown") {
        const shouldShowToast = 
          error.type === "tauri_error" || 
          error.type === "fetch_error" ||
          (error.type === "unhandled_rejection" && !error.message.includes("ResizeObserver"))

        if (shouldShowToast) {
          toast.error("Error", error.message)
        }
      }

      // Call custom error handler
      onError?.(error)
    }

    return tracker.addListener(handleError)
  }, [onError, enableToast, enableReporting, toast])

  return {
    reportError: (error: any, type?: AsyncError["type"]) => {
      const asyncError = createAsyncError(error, type)
      tracker.reportError(asyncError)
    },
    getRecentErrors: () => tracker.getRecentErrors(),
    clearErrors: () => tracker.clearErrors()
  }
}

// Component for global async error handling
export function AsyncErrorHandler({ 
  onError, 
  enableToast = true, 
  enableReporting = true 
}: AsyncErrorHandlerProps) {
  const tracker = AsyncErrorTracker.getInstance()
  
  useAsyncErrorHandler({ onError, enableToast, enableReporting })

  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault() // Prevent default console logging
      
      const error = createAsyncError(event.reason, "unhandled_rejection")
      tracker.reportError(error)
    }

    // Handle general window errors (catch-all)
    const handleWindowError = (event: ErrorEvent) => {
      // Skip if this is already handled by ErrorBoundary
      if (event.error?.__handledByErrorBoundary) {
        return
      }

      const error = createAsyncError(event.error || event.message, "unknown")
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

// Higher-order component for wrapping components with async error handling
export function withAsyncErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options: AsyncErrorHandlerProps = {}
) {
  return function WithAsyncErrorHandling(props: P) {
    useAsyncErrorHandler(options)
    return <Component {...props} />
  }
}

// Utility for wrapping async functions with error handling
export function wrapAsyncFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorType?: AsyncError["type"]
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      const tracker = AsyncErrorTracker.getInstance()
      const asyncError = createAsyncError(error, errorType)
      tracker.reportError(asyncError)
      throw error // Re-throw so calling code can still handle it
    }
  }) as T
}

// Utility for wrapping Tauri invoke calls
export function safeInvoke<T = any>(
  command: string, 
  args?: Record<string, any>
): Promise<T> {
  return wrapAsyncFunction(
    (cmd: string, arguments_?: Record<string, any>) => invoke<T>(cmd, arguments_),
    "tauri_error"
  )(command, args)
}