import React, { ReactNode, useEffect, useState } from "react"
import { AlertCircle, Wifi, WifiOff, RotateCcw, Settings } from "lucide-react"
// import { invoke } from "@tauri-apps/api/core" // Removed unused import
import { ComponentErrorBoundary } from "./ErrorBoundary"
import { useAsyncErrorHandler, safeInvoke } from "./AsyncErrorHandler"
import { useToast } from "../ui/toast"
import type { CategorizedError } from "../../types/middleware"

// ============================================================================
// TYPE-SAFE TAURI ERROR HANDLING
// ============================================================================

/**
 * Discriminated union for Tauri error types with complete type safety
 */
export type TauriErrorKind = 'connection' | 'permission' | 'timeout' | 'invalid_data' | 'unknown'

export interface TauriError {
  code?: string
  message: string
  kind: TauriErrorKind
}

/**
 * Tauri connection state with type safety
 */
interface TauriConnectionState {
  isConnected: boolean
  lastError: TauriError | null
  retryCount: number
  isRetrying: boolean
}

/**
 * Props interface with complete type safety
 */
interface TauriErrorBoundaryProps {
  children: ReactNode
  fallbackComponent?: React.ComponentType<TauriErrorFallbackProps>
  enableHeartbeat?: boolean
  heartbeatInterval?: number
  maxRetries?: number
  onConnectionChange?: (connected: boolean) => void
}

/**
 * Fallback component props with type safety
 */
interface TauriErrorFallbackProps {
  error: TauriError
  connectionState: TauriConnectionState
  onRetry: () => void
  onOpenSettings: () => void
}

/**
 * Error details interface for categorization
 */
interface ErrorAnalysisResult {
  kind: TauriErrorKind
  code: string
  userMessage: string
  technicalMessage: string
  isRecoverable: boolean
  suggestedActions: string[]
}

// ============================================================================
// TYPE-SAFE ERROR CATEGORIZATION
// ============================================================================

/**
 * Type-safe error categorization with enhanced analysis
 */
function categorizeTauriError(error: unknown): TauriError {
  let message = "Unknown Tauri error"
  // let kind: TauriErrorKind = "unknown" // Will be determined dynamically
  let code = "UNKNOWN_ERROR"

  // Extract error information safely
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>
    message = typeof errorObj.message === 'string' ? errorObj.message : JSON.stringify(error)
    code = typeof errorObj.code === 'string' ? errorObj.code : code
  }

  // Analyze error details for categorization
  const analysis = analyzeErrorDetails(message, code)
  
  return {
    code: analysis.code,
    message: analysis.userMessage,
    kind: analysis.kind
  }
}

/**
 * Detailed error analysis with type safety
 */
function analyzeErrorDetails(message: string, code: string): ErrorAnalysisResult {
  const lowerMessage = message.toLowerCase()
  
  // Connection-related errors
  if (
    lowerMessage.includes("failed to invoke") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("backend not available") ||
    lowerMessage.includes("ipc") ||
    lowerMessage.includes("websocket") ||
    lowerMessage.includes("network unreachable")
  ) {
    return {
      kind: "connection",
      code: code || "CONNECTION_FAILED",
      userMessage: "Unable to communicate with the application backend",
      technicalMessage: message,
      isRecoverable: true,
      suggestedActions: ["Check if the app is running properly", "Restart the application", "Check system resources"]
    }
  }
  
  // Permission errors
  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("not allowed")
  ) {
    return {
      kind: "permission",
      code: code || "PERMISSION_DENIED",
      userMessage: "The requested operation requires additional permissions",
      technicalMessage: message,
      isRecoverable: true,
      suggestedActions: ["Check system settings", "Run as administrator if needed", "Grant required permissions"]
    }
  }
  
  // Timeout errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("deadline exceeded") ||
    lowerMessage.includes("operation timeout")
  ) {
    return {
      kind: "timeout",
      code: code || "TIMEOUT",
      userMessage: "The operation took too long to complete",
      technicalMessage: message,
      isRecoverable: true,
      suggestedActions: ["Check system load", "Try again", "Check network connectivity"]
    }
  }
  
  // Data validation errors
  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("validation") ||
    lowerMessage.includes("parse") ||
    lowerMessage.includes("malformed") ||
    lowerMessage.includes("corrupt")
  ) {
    return {
      kind: "invalid_data",
      code: code || "INVALID_DATA",
      userMessage: "There was an issue with the data format or content",
      technicalMessage: message,
      isRecoverable: false,
      suggestedActions: ["Try again with different data", "Reset to default settings", "Contact support"]
    }
  }

  // Unknown/unclassified errors
  return {
    kind: "unknown",
    code: code || "UNKNOWN_ERROR",
    userMessage: "An unexpected backend error occurred",
    technicalMessage: message,
    isRecoverable: false,
    suggestedActions: ["Restart the application", "Check logs", "Contact support"]
  }
}

// ============================================================================
// FALLBACK COMPONENT WITH TYPE SAFETY
// ============================================================================

/**
 * Default fallback component with complete type safety
 */
function DefaultTauriFallback({
  error,
  connectionState,
  onRetry,
  onOpenSettings
}: TauriErrorFallbackProps) {
  const analysis = analyzeErrorDetails(error.message, error.code || "")

  const getErrorIcon = () => {
    switch (error.kind) {
      case "connection":
        return <WifiOff className="w-8 h-8 text-destructive" />
      case "permission":
        return <AlertCircle className="w-8 h-8 text-yellow-500" />
      case "timeout":
        return <AlertCircle className="w-8 h-8 text-orange-500" />
      case "invalid_data":
        return <AlertCircle className="w-8 h-8 text-red-500" />
      default:
        return <AlertCircle className="w-8 h-8 text-destructive" />
    }
  }

  const getErrorTitle = () => {
    switch (error.kind) {
      case "connection":
        return "Connection Problem"
      case "permission":
        return "Permission Required"
      case "timeout":
        return "Operation Timeout"
      case "invalid_data":
        return "Data Error"
      default:
        return "Backend Error"
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[200px] p-6">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center mb-4">
          {getErrorIcon()}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">{getErrorTitle()}</h3>
        
        <p className="text-sm text-muted-foreground mb-6">
          {analysis.userMessage}
        </p>

        {error.code && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Error Code: {error.code}
          </p>
        )}

        {/* Suggested Actions */}
        {analysis.suggestedActions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium mb-2">Suggested Actions:</p>
            <ul className="text-xs text-muted-foreground text-left">
              {analysis.suggestedActions.map((action, index) => (
                <li key={index} className="mb-1">• {action}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {analysis.isRecoverable && (
            <button
              onClick={onRetry}
              disabled={connectionState.isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground 
                       rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
            >
              <RotateCcw size={16} className={connectionState.isRetrying ? "animate-spin" : ""} />
              {connectionState.isRetrying ? "Retrying..." : "Try Again"}
            </button>
          )}

          {error.kind === "permission" && (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground 
                       rounded-md hover:bg-secondary/80 text-sm"
            >
              <Settings size={16} />
              Settings
            </button>
          )}
        </div>

        {/* Connection status indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          {connectionState.isConnected ? (
            <>
              <Wifi size={14} className="text-green-500" />
              <span className="text-green-600">Backend Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-destructive" />
              <span className="text-destructive">Backend Disconnected</span>
            </>
          )}
        </div>

        {/* Technical details (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="text-xs cursor-pointer">Technical Details</summary>
            <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto">
              {analysis.technicalMessage}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT WITH TYPE SAFETY
// ============================================================================

/**
 * Enhanced Tauri error boundary with complete type safety
 */
export function TauriErrorBoundary({
  children,
  fallbackComponent: FallbackComponent = DefaultTauriFallback,
  enableHeartbeat = true,
  heartbeatInterval = 5000,
  maxRetries = 3,
  onConnectionChange
}: TauriErrorBoundaryProps) {
  const [connectionState, setConnectionState] = useState<TauriConnectionState>({
    isConnected: true,
    lastError: null,
    retryCount: 0,
    isRetrying: false
  })

  const [currentError, setCurrentError] = useState<TauriError | null>(null)
  const toast = useToast()

  // Handle async Tauri errors with type safety
  const { reportError } = useAsyncErrorHandler({
    onError: (error: CategorizedError) => {
      if (error.category === "tauri") {
        const tauriError = categorizeTauriError(error.originalError)
        setCurrentError(tauriError)
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          lastError: tauriError
        }))
      }
    },
    config: {
      enableToast: false, // We handle toasts ourselves
      enableBackendReporting: true,
      enableConsoleLogging: process.env.NODE_ENV === 'development'
    }
  })

  // Connection heartbeat with type safety
  useEffect(() => {
    if (!enableHeartbeat) return

    const checkConnection = async (): Promise<void> => {
      try {
        await safeInvoke("test_db_connection")
        
        if (!connectionState.isConnected) {
          setConnectionState(prev => ({
            ...prev,
            isConnected: true,
            lastError: null,
            retryCount: 0
          }))
          setCurrentError(null)
          onConnectionChange?.(true)
          toast.success("Connection restored", "Backend connection is working again")
        }
      } catch (error) {
        const tauriError = categorizeTauriError(error)
        
        if (connectionState.isConnected) {
          setConnectionState(prev => ({
            ...prev,
            isConnected: false,
            lastError: tauriError
          }))
          onConnectionChange?.(false)
          
          // Only show toast for new connection issues
          if (tauriError.kind === "connection") {
            toast.error("Connection lost", "Unable to reach backend")
          }
        }
      }
    }

    const interval = setInterval(() => {
      checkConnection().catch(error => {
        console.warn("Heartbeat check failed:", error)
      })
    }, heartbeatInterval)
    
    // Initial check
    checkConnection().catch(error => {
      console.warn("Initial connection check failed:", error)
    })

    return () => clearInterval(interval)
  }, [enableHeartbeat, heartbeatInterval, connectionState.isConnected, onConnectionChange, toast])

  const handleRetry = async (): Promise<void> => {
    if (connectionState.retryCount >= maxRetries) {
      toast.warning("Max retries reached", "Please restart the application")
      return
    }

    setConnectionState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }))

    try {
      // Test connection
      await safeInvoke("test_db_connection")
      
      // Clear error state
      setCurrentError(null)
      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        isRetrying: false,
        lastError: null
      }))
      
      onConnectionChange?.(true)
      toast.success("Connected", "Backend connection restored")
    } catch (error) {
      const tauriError = categorizeTauriError(error)
      setCurrentError(tauriError)
      setConnectionState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: tauriError
      }))
      
      toast.error("Still unable to connect", tauriError.message)
    }
  }

  const handleOpenSettings = (): void => {
    // This would typically navigate to settings or show a settings modal
    console.log("Open settings requested")
    // TODO: Implement settings navigation
  }

  // If we have a current error, show the fallback
  if (currentError) {
    return (
      <FallbackComponent
        error={currentError}
        connectionState={connectionState}
        onRetry={handleRetry}
        onOpenSettings={handleOpenSettings}
      />
    )
  }

  return (
    <ComponentErrorBoundary
      componentName="TauriErrorBoundary"
      onError={(error) => {
        const tauriError = categorizeTauriError(error)
        setCurrentError(tauriError)
        // Map TauriErrorKind to valid CategorizedError subtype
        const mappedSubtype = tauriError.kind === 'connection' ? 'ipc_failure' : 
                             tauriError.kind === 'permission' ? 'permission_denied' :
                             tauriError.kind === 'timeout' ? 'ipc_failure' :
                             'ipc_failure'
        reportError(error, "tauri", mappedSubtype)
      }}
    >
      {children}
    </ComponentErrorBoundary>
  )
}

// ============================================================================
// HIGHER-ORDER COMPONENT WITH TYPE SAFETY
// ============================================================================

/**
 * Higher-order component for wrapping components that use Tauri
 */
export function withTauriErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<TauriErrorBoundaryProps, "children"> = {}
) {
  return function WithTauriErrorBoundary(props: P) {
    return (
      <TauriErrorBoundary {...options}>
        <Component {...props} />
      </TauriErrorBoundary>
    )
  }
}

// ============================================================================
// UTILITY FUNCTIONS FOR EXTERNAL USE
// ============================================================================

/**
 * Check if an error is a Tauri-related error
 */
export function isTauriError(error: unknown): error is TauriError {
  return typeof error === 'object' && 
         error !== null && 
         'kind' in error && 
         'message' in error &&
         typeof (error as TauriError).kind === 'string' &&
         typeof (error as TauriError).message === 'string'
}

/**
 * Create a Tauri error with type safety
 */
export function createTauriError(
  message: string,
  kind: TauriErrorKind = 'unknown',
  code?: string
): TauriError {
  return { message, kind, code }
}

/**
 * Get user-friendly error message for a Tauri error
 */
export function getTauriErrorUserMessage(error: TauriError): string {
  const analysis = analyzeErrorDetails(error.message, error.code || "")
  return analysis.userMessage
}

/**
 * Check if a Tauri error is recoverable
 */
export function isTauriErrorRecoverable(error: TauriError): boolean {
  const analysis = analyzeErrorDetails(error.message, error.code || "")
  return analysis.isRecoverable
}

/**
 * Get suggested actions for a Tauri error
 */
export function getTauriErrorSuggestedActions(error: TauriError): string[] {
  const analysis = analyzeErrorDetails(error.message, error.code || "")
  return analysis.suggestedActions
}

// Export types for external use
export type { TauriConnectionState, TauriErrorFallbackProps, ErrorAnalysisResult }