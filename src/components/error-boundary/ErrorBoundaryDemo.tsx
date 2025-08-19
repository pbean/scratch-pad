import React, { useState } from "react"
import { Bug, AlertTriangle, Zap, Network } from "lucide-react"
import { ComponentErrorBoundary, TauriErrorBoundary, useAsyncErrorHandler, safeInvoke } from "."
import { useToast } from "../ui/toast"

// Demo components that simulate different types of errors
function RenderErrorDemo() {
  const [shouldError, setShouldError] = useState(false)
  
  if (shouldError) {
    throw new Error("Simulated render error: Component failed to render properly")
  }
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">Render Error Test</h3>
      <p className="text-sm text-muted-foreground mb-3">
        This component will throw a render error when the button is clicked.
      </p>
      <button
        onClick={() => setShouldError(true)}
        className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
      >
        <Bug size={14} className="inline mr-1" />
        Trigger Render Error
      </button>
    </div>
  )
}

function AsyncErrorDemo() {
  const { reportError } = useAsyncErrorHandler()
  const toast = useToast()
  
  const simulateAsyncError = async () => {
    try {
      // Simulate async operation failure
      await new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Simulated async operation failed"))
        }, 1000)
      })
    } catch (error) {
      // This will be caught by the async error handler
      reportError(error, "unknown")
    }
  }
  
  const simulatePromiseRejection = () => {
    // This will trigger unhandled promise rejection
    Promise.reject(new Error("Simulated unhandled promise rejection"))
  }
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">Async Error Test</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Test async error handling and unhandled promise rejections.
      </p>
      <div className="space-x-2">
        <button
          onClick={simulateAsyncError}
          className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
        >
          <Zap size={14} className="inline mr-1" />
          Async Error
        </button>
        <button
          onClick={simulatePromiseRejection}
          className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200 transition-colors"
        >
          <AlertTriangle size={14} className="inline mr-1" />
          Promise Rejection
        </button>
      </div>
    </div>
  )
}

function TauriErrorDemo() {
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  
  const simulateTauriError = async () => {
    setIsLoading(true)
    try {
      // Try to call a non-existent Tauri command
      await safeInvoke("non_existent_command", { data: "test" })
    } catch (error) {
      toast.error("Tauri Error", `Command failed: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  const testConnection = async () => {
    setIsLoading(true)
    try {
      const result = await safeInvoke("test_db_connection")
      toast.success("Connection OK", result)
    } catch (error) {
      toast.error("Connection Failed", `Unable to reach backend: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">Tauri IPC Error Test</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Test Tauri backend communication and error handling.
      </p>
      <div className="space-x-2">
        <button
          onClick={testConnection}
          disabled={isLoading}
          className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors disabled:opacity-50"
        >
          <Network size={14} className="inline mr-1" />
          {isLoading ? "Testing..." : "Test Connection"}
        </button>
        <button
          onClick={simulateTauriError}
          disabled={isLoading}
          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
        >
          <Bug size={14} className="inline mr-1" />
          {isLoading ? "Calling..." : "Invalid Command"}
        </button>
      </div>
    </div>
  )
}

// Main demo component
export function ErrorBoundaryDemo() {
  const [resetKey, setResetKey] = useState(0)
  
  const resetAll = () => {
    setResetKey(prev => prev + 1)
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Error Boundary Demo</h2>
          <p className="text-muted-foreground">
            Test different types of error handling scenarios.
          </p>
        </div>
        <button
          onClick={resetAll}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          Reset All
        </button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Render Error Demo */}
        <ComponentErrorBoundary key={`render-${resetKey}`} componentName="RenderErrorDemo">
          <RenderErrorDemo />
        </ComponentErrorBoundary>
        
        {/* Async Error Demo */}
        <div key={`async-${resetKey}`}>
          <AsyncErrorDemo />
        </div>
        
        {/* Tauri Error Demo */}
        <TauriErrorBoundary key={`tauri-${resetKey}`}>
          <TauriErrorDemo />
        </TauriErrorBoundary>
      </div>
      
      <div className="border-t pt-6">
        <h3 className="font-medium mb-3">Error Handling Features</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-medium text-sm mb-2">React Error Boundaries</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Catch render errors and prevent crashes</li>
              <li>• Provide recovery options (retry, reload, reset)</li>
              <li>• Show user-friendly error messages</li>
              <li>• Report errors to backend for debugging</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Async Error Handling</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Catch unhandled promise rejections</li>
              <li>• Handle Tauri IPC communication errors</li>
              <li>• Show toast notifications for user errors</li>
              <li>• Categorize errors by severity and type</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}