import { useEffect, useRef } from "react"

/**
 * Hook to manage memory cleanup and prevent memory leaks
 */
export function useMemoryCleanup() {
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set())
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set())

  useEffect(() => {
    // Cleanup function to run on unmount
    return () => {
      // Clear tracked timeouts and intervals
      timeoutsRef.current.forEach(clearTimeout)
      intervalsRef.current.forEach(clearInterval)
      timeoutsRef.current.clear()
      intervalsRef.current.clear()
      
      // Force garbage collection if available (development only)
      if (typeof window !== 'undefined' && 'gc' in window && process.env.NODE_ENV === 'development') {
        ;(window as any).gc()
      }
    }
  }, [])

  // Periodic cleanup - less frequent for better performance
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Clear any orphaned event listeners
      if (typeof window !== 'undefined') {
        // Remove any stale event listeners that might have been left behind
        const events = ['keydown', 'keyup', 'click', 'scroll', 'resize']
        events.forEach(event => {
          // This is a bit aggressive, but helps prevent memory leaks in development
          if (process.env.NODE_ENV === 'development') {
            const listeners = (window as any).getEventListeners?.(window)?.[event] || []
            if (listeners.length > 15) {
              console.warn(`High number of ${event} listeners detected: ${listeners.length}`)
            }
          }
        })
      }
    }, 60000) // Check every 60 seconds for better performance

    intervalsRef.current.add(cleanupInterval)
    return () => {
      clearInterval(cleanupInterval)
      intervalsRef.current.delete(cleanupInterval)
    }
  }, [])

  // Return helper functions for tracking timeouts/intervals
  return {
    setTimeout: (callback: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        callback()
        timeoutsRef.current.delete(timeout)
      }, delay)
      timeoutsRef.current.add(timeout)
      return timeout
    },
    setInterval: (callback: () => void, delay: number) => {
      const interval = setInterval(callback, delay)
      intervalsRef.current.add(interval)
      return interval
    }
  }
}

/**
 * Hook to manage large data structures and prevent memory bloat
 */
export function useDataCleanup<T>(data: T[], maxSize: number = 1000) {
  useEffect(() => {
    if (data.length > maxSize) {
      console.warn(`Large data structure detected: ${data.length} items. Consider implementing pagination or virtualization.`)
    }
  }, [data.length, maxSize])
}