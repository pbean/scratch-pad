interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  variant?: "default" | "gradient"
}

export function LoadingSpinner({ size = "md", className = "", variant = "default" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  }

  if (variant === "gradient") {
    return (
      <div className={`loading-spinner ${sizeClasses[size]} scale-in ${className}`} />
    )
  }

  return (
    <div
      className={`loading-spinner ${sizeClasses[size]} border-2 border-muted-foreground border-t-foreground rounded-full scale-in ${className}`}
    />
  )
}

interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
  variant?: "default" | "gradient"
  showDots?: boolean
}

export function LoadingState({
  message = "Loading...",
  size = "md",
  className = "",
  variant = "default",
  showDots = true
}: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center gap-3 fade-in stagger-children ${className}`}>
      <LoadingSpinner size={size} variant={variant} />
      <span className="text-sm text-muted-foreground">
        {message}
        {showDots && <LoadingDots />}
      </span>
    </div>
  )
}

interface FullPageLoadingProps {
  message?: string
  variant?: "default" | "gradient"
}

export function FullPageLoading({ message = "Loading...", variant = "gradient" }: FullPageLoadingProps) {
  return (
    <div className="h-full flex items-center justify-center fade-in">
      <div className="text-center stagger-children">
        <LoadingSpinner size="lg" variant={variant} className="mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">
          {message}
          <LoadingDots />
        </p>
        <div className="mt-4 text-xs text-muted-foreground/60">
          Setting up your workspace...
        </div>
      </div>
    </div>
  )
}

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className = "", width = "100%", height = "1rem" }: SkeletonProps) {
  return (
    <div
      className={`skeleton rounded ${className}`}
      style={{ width, height }}
    />
  )
}

interface LoadingDotsProps {
  className?: string
}

function LoadingDots({ className = "" }: LoadingDotsProps) {
  return (
    <span className={`inline-flex ml-1 ${className}`}>
      <span className="typing-indicator" style={{ animationDelay: '0s' }}>.</span>
      <span className="typing-indicator" style={{ animationDelay: '0.2s' }}>.</span>
      <span className="typing-indicator" style={{ animationDelay: '0.4s' }}>.</span>
    </span>
  )
}

interface InlineLoadingProps {
  message?: string
  size?: "sm" | "md"
  className?: string
}

export function InlineLoading({ message = "Loading", size = "sm", className = "" }: InlineLoadingProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-muted-foreground ${className}`}>
      <LoadingSpinner size={size} />
      <span className="text-sm">{message}</span>
    </span>
  )
}

interface ProgressBarProps {
  progress: number
  className?: string
  showPercentage?: boolean
}

export function ProgressBar({ progress, className = "", showPercentage = false }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary smooth-transition"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  )
}