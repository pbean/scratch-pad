import React, { ReactNode, useEffect, useState } from "react"
import { AlertCircle, Wifi, WifiOff, RotateCcw, Settings } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { ComponentErrorBoundary } from "./ErrorBoundary"
import { useAsyncErrorHandler, safeInvoke } from "./AsyncErrorHandler"
import { useToast } from "../ui/toast"

// Tauri-specific error types
export interface TauriError {
  code?: string
  message: string
  kind?: "connection" | "permission" | "timeout" | "invalid_data" | "unknown"
}

interface TauriConnectionState {
  isConnected: boolean
  lastError: TauriError | null
  retryCount: number
  isRetrying: boolean
}

interface TauriErrorBoundaryProps {
  children: ReactNode
  fallbackComponent?: React.ComponentType<{
    error: TauriError
    connectionState: TauriConnectionState
    onRetry: () => void
    onOpenSettings: () => void
  }>
  enableHeartbeat?: boolean
  heartbeatInterval?: number
  maxRetries?: number
  onConnectionChange?: (connected: boolean) => void
}

function categorizeTauriError(error: any): TauriError {
  const message = error?.message || error || "Unknown Tauri error"
  let kind: TauriError["kind"] = "unknown"
  let code = error?.code

  // Connection-related errors
  if (
    message.includes("failed to invoke") ||
    message.includes("connection") ||
    message.includes("backend not available") ||
    message.includes("ipc")
  ) {
    kind = "connection"
    code = code || "CONNECTION_FAILED"
  }
  
  // Permission errors
  else if (
    message.includes("permission") ||
    message.includes("access denied") ||
    message.includes("forbidden")
  ) {
    kind = "permission"
    code = code || "PERMISSION_DENIED"
  }
  
  // Timeout errors
  else if (
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    kind = "timeout"
    code = code || "TIMEOUT"
  }
  
  // Data validation errors
  else if (
    message.includes("invalid") ||
    message.includes("validation") ||
    message.includes("parse")
  ) {
    kind = "invalid_data"
    code = code || "INVALID_DATA"
  }

  return { code, message, kind }
}

function DefaultTauriFallback({
  error,
  connectionState,
  onRetry,
  onOpenSettings
}: {
  error: TauriError
  connectionState: TauriConnectionState
  onRetry: () => void
  onOpenSettings: () => void
}) {
  const getErrorIcon = () => {
    switch (error.kind) {
      case "connection":
        return <WifiOff className="w-8 h-8 text-destructive" />
      case "permission":
        return <AlertCircle className="w-8 h-8 text-yellow-500" />
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

  const getErrorDescription = () => {
    switch (error.kind) {
      case "connection":
        return "Unable to communicate with the application backend. Please check if the app is running properly."
      case "permission":
        return "The requested operation requires additional permissions. Please check your system settings."
      case "timeout":
        return "The operation took too long to complete. This might be due to system load or connectivity issues."
      case "invalid_data":
        return "There was an issue with the data format or content. Please try again."
      default:
        return "An unexpected backend error occurred. Please try restarting the application."
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
          {getErrorDescription()}
        </p>

        {error.code && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Error Code: {error.code}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onRetry}
            disabled={connectionState.isRetrying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground 
                     rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
          >
            <RotateCcw size={16} className={connectionState.isRetrying ? "animate-spin" : ""} />
            {connectionState.isRetrying ? "Retrying..." : "Try Again"}
          </button>

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
      </div>
    </div>
  )
}

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

  // Handle async Tauri errors
  const { reportError } = useAsyncErrorHandler({
    onError: (error) => {
      if (error.type === "tauri_error") {
        const tauriError = categorizeTauriError(error.originalError)
        setCurrentError(tauriError)
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          lastError: tauriError
        }))
      }
    },
    enableToast: false, // We handle toasts ourselves
    enableReporting: true
  })

  // Connection heartbeat
  useEffect(() => {
    if (!enableHeartbeat) return

    const checkConnection = async () => {
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

    const interval = setInterval(checkConnection, heartbeatInterval)
    
    // Initial check
    checkConnection()

    return () => clearInterval(interval)
  }, [enableHeartbeat, heartbeatInterval, connectionState.isConnected, onConnectionChange, toast])

  const handleRetry = async () => {
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

  const handleOpenSettings = () => {
    // This would typically navigate to settings or show a settings modal
    console.log("Open settings requested")
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
      onError={(error, errorInfo) => {
        const tauriError = categorizeTauriError(error)
        setCurrentError(tauriError)
        reportError(error, "tauri_error")
      }}
    >
      {children}
    </ComponentErrorBoundary>
  )
}

// Higher-order component for wrapping components that use Tauri
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