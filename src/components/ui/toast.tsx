import { useEffect, useState } from "react"
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react"

export interface Toast {
  id: string
  type: "success" | "error" | "warning" | "info"
  title: string
  description?: string
  duration?: number
}

interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

export function ToastComponent({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove()
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const handleRemove = () => {
    setIsRemoving(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 300)
  }

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle size={20} className="text-green-500" />
      case "error":
        return <XCircle size={20} className="text-red-500" />
      case "warning":
        return <AlertCircle size={20} className="text-yellow-500" />
      case "info":
        return <Info size={20} className="text-blue-500" />
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
      case "warning":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
      case "info":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
    }
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm w-full
        ${getBackgroundColor()}
        ${isVisible && !isRemoving ? 'toast-enter hover-lift' : ''}
        ${isRemoving ? 'opacity-0 transform translate-x-full scale-95' : ''}
        smooth-transition
      `}
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm">{toast.title}</h4>
        {toast.description && (
          <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={handleRemove}
        className="text-muted-foreground hover:text-foreground smooth-transition p-1 hover-lift"
      >
        <X size={16} />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// Toast hook for easy usage
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }
    setToasts((prev) => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  const success = (title: string, description?: string) => {
    addToast({ type: "success", title, description })
  }

  const error = (title: string, description?: string) => {
    addToast({ type: "error", title, description })
  }

  const warning = (title: string, description?: string) => {
    addToast({ type: "warning", title, description })
  }

  const info = (title: string, description?: string) => {
    addToast({ type: "info", title, description })
  }

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    ToastContainer: () => <ToastContainer toasts={toasts} onRemove={removeToast} />,
  }
}