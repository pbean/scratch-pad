import { Component, ReactNode } from "react"
import { AlertTriangle, RotateCcw, RefreshCw, Home, Bug } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

// Error types that can be handled differently
export type ErrorSeverity = "low" | "medium" | "high" | "critical"

export interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorBoundaryStack?: string
}

export interface ErrorBoundaryError extends Error {
  errorInfo?: ErrorInfo
  severity?: ErrorSeverity
  recoverable?: boolean
  timestamp?: number
  userAgent?: string
  url?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: ErrorBoundaryError | null
  errorId: string | null
  retryCount: number
  isRecovering: boolean
  lastErrorTime: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: ErrorBoundaryError, retry: () => void) => ReactNode
  onError?: (error: ErrorBoundaryError, errorInfo: ErrorInfo) => void
  level?: "application" | "view" | "component" | "utility"
  name?: string
  maxRetries?: number
  isolateErrors?: boolean
  showErrorDetails?: boolean
  enableRecovery?: boolean
}

interface RecoveryAction {
  label: string
  action: () => void | Promise<void>
  icon?: ReactNode
  variant?: "primary" | "secondary" | "destructive"
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set()

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const enhancedError: ErrorBoundaryError = {
      ...error,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity: ErrorBoundary.categorizeError(error),
      recoverable: ErrorBoundary.isRecoverableError(error)
    }

    return {
      hasError: true,
      error: enhancedError,
      errorId,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const enhancedError: ErrorBoundaryError = {
      ...error,
      errorInfo,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity: ErrorBoundary.categorizeError(error),
      recoverable: ErrorBoundary.isRecoverableError(error)
    }

    this.reportError(enhancedError, errorInfo)
    this.props.onError?.(enhancedError, errorInfo)
  }

  private static categorizeError(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ""

    // Critical errors - app-breaking
    if (
      message.includes("failed to fetch") ||
      message.includes("network error") ||
      message.includes("connection") ||
      stack.includes("store") ||
      stack.includes("zustand")
    ) {
      return "critical"
    }

    // High severity - major functionality broken  
    if (
      message.includes("tauri") ||
      message.includes("invoke") ||
      message.includes("ipc") ||
      stack.includes("database") ||
      stack.includes("settings")
    ) {
      return "high"
    }

    // Medium severity - feature broken
    if (
      message.includes("render") ||
      message.includes("component") ||
      stack.includes("react")
    ) {
      return "medium"
    }

    // Low severity - minor issues
    return "low"
  }

  private static isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    const nonRecoverablePatterns = [
      "module not found",
      "syntax error",
      "reference error",
      "type error: cannot read properties of null",
      "maximum call stack"
    ]

    return !nonRecoverablePatterns.some(pattern => message.includes(pattern))
  }

  private async reportError(error: ErrorBoundaryError, errorInfo: ErrorInfo) {
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      severity: error.severity,
      timestamp: error.timestamp,
      userAgent: error.userAgent,
      url: error.url,
      boundaryName: this.props.name || "Unknown",
      boundaryLevel: this.props.level || "component",
      retryCount: this.state.retryCount
    }

    try {
      await invoke("log_frontend_error", { error: errorReport })
    } catch (reportingError) {
      console.error("Failed to report error to backend:", reportingError)
      // Fallback to console logging
      console.error("Frontend Error Report:", errorReport)
    }
  }

  private handleRetry = async () => {
    if (this.state.retryCount >= (this.props.maxRetries || 3)) {
      return
    }

    this.setState({ isRecovering: true })

    // Add delay before retry to prevent rapid failures
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 5000)
    const timeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
        isRecovering: false
      }))
    }, delay)

    this.retryTimeouts.add(timeout)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    // Clear local storage and reset app state
    try {
      localStorage.clear()
      sessionStorage.clear()
      this.handleReload()
    } catch (e) {
      console.error("Failed to reset app state:", e)
      this.handleReload()
    }
  }

  private handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      lastErrorTime: 0
    })
  }

  componentWillUnmount() {
    // Clean up retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts.clear()
  }

  private getRecoveryActions(): RecoveryAction[] {
    const { error } = this.state
    const { level, maxRetries = 3 } = this.props

    const actions: RecoveryAction[] = []

    // Retry action (if recoverable and under retry limit)
    if (error?.recoverable && this.state.retryCount < maxRetries) {
      actions.push({
        label: this.state.isRecovering ? "Retrying..." : "Try Again",
        action: this.handleRetry,
        icon: <RotateCcw size={16} />,
        variant: "primary"
      })
    }

    // Home action (for view-level errors)
    if (level === "view") {
      actions.push({
        label: "Go to Notes",
        action: this.handleGoHome,
        icon: <Home size={16} />,
        variant: "secondary"
      })
    }

    // Reload action (always available)
    actions.push({
      label: "Reload App",
      action: this.handleReload,
      icon: <RefreshCw size={16} />,
      variant: "secondary"
    })

    // Reset action (for critical errors)
    if (error?.severity === "critical" || this.state.retryCount >= maxRetries) {
      actions.push({
        label: "Reset App",
        action: this.handleReset,
        icon: <Bug size={16} />,
        variant: "destructive"
      })
    }

    return actions
  }

  private renderErrorUI() {
    const { error, errorId } = this.state
    const { level, showErrorDetails = false, name } = this.props

    if (!error) return null

    const recoveryActions = this.getRecoveryActions()
    const isComponentLevel = level === "component" || level === "utility"

    const containerClasses = isComponentLevel
      ? "p-4 rounded-lg border border-destructive/20 bg-destructive/5"
      : "min-h-screen flex items-center justify-center p-6"

    const contentClasses = isComponentLevel
      ? "text-center"
      : "text-center max-w-lg mx-auto"

    return (
      <div className={containerClasses}>
        <div className={contentClasses}>
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          
          <h2 className="text-lg font-semibold mb-2">
            {isComponentLevel ? "Component Error" : "Something went wrong"}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-4">
            {error.severity === "critical" && "A critical error occurred that may affect app functionality."}
            {error.severity === "high" && "An error occurred that may impact this feature."}
            {error.severity === "medium" && "A display error occurred in this component."}
            {error.severity === "low" && "A minor error occurred."}
          </p>

          {showErrorDetails && (
            <details className="text-left mb-4 p-3 bg-muted/50 rounded text-xs">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <div className="mt-2 space-y-2">
                <div><strong>Error ID:</strong> {errorId}</div>
                <div><strong>Boundary:</strong> {name || "Unknown"}</div>
                <div><strong>Message:</strong> {error.message}</div>
                {error.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="text-xs mt-1 whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            {recoveryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                disabled={this.state.isRecovering}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                  transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                  ${action.variant === "secondary" ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}
                  ${action.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                `}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleRetry)
      }

      return this.renderErrorUI()
    }

    return this.props.children
  }
}

// Specialized error boundaries for different use cases

export function ApplicationErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="application"
      name="Application"
      maxRetries={2}
      showErrorDetails={process.env.NODE_ENV === "development"}
      enableRecovery={true}
    >
      {children}
    </ErrorBoundary>
  )
}

export function ViewErrorBoundary({ 
  children, 
  viewName 
}: { 
  children: ReactNode
  viewName: string 
}) {
  return (
    <ErrorBoundary
      level="view"
      name={`${viewName}View`}
      maxRetries={3}
      showErrorDetails={false}
      enableRecovery={true}
    >
      {children}
    </ErrorBoundary>
  )
}

export function ComponentErrorBoundary({ 
  children, 
  componentName,
  onError
}: { 
  children: ReactNode
  componentName: string
  onError?: (error: ErrorBoundaryError, errorInfo: ErrorInfo) => void
}) {
  return (
    <ErrorBoundary
      level="component"
      name={componentName}
      maxRetries={1}
      showErrorDetails={false}
      enableRecovery={true}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  )
}