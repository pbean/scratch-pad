import { useEffect, useRef } from "react"

interface PerformanceMetrics {
  renderTime: number
  componentName: string
  timestamp: number
}

/**
 * Hook for monitoring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0)

  useEffect(() => {
    renderStartTime.current = performance.now()
  })

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current
    
    // Only log slow renders (> 16ms for 60fps)
    if (renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
    }

    // Store metrics for debugging
    if (process.env.NODE_ENV === 'development') {
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      }
      
      // Store in sessionStorage for debugging
      const existingMetrics = JSON.parse(sessionStorage.getItem('renderMetrics') || '[]')
      existingMetrics.push(metrics)
      
      // Keep only last 100 metrics
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100)
      }
      
      sessionStorage.setItem('renderMetrics', JSON.stringify(existingMetrics))
    }
  })
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory
        if (memory) {
          const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
          const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024)
          const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
          
          // Warn if memory usage is high
          if (usedMB > 100) {
            console.warn(`High memory usage: ${usedMB}MB / ${limitMB}MB`)
          }
          
          // Store metrics
          sessionStorage.setItem('memoryMetrics', JSON.stringify({
            used: usedMB,
            total: totalMB,
            limit: limitMB,
            timestamp: Date.now()
          }))
        }
      }

      // Check memory every 30 seconds
      const interval = setInterval(checkMemory, 30000)
      checkMemory() // Initial check

      return () => clearInterval(interval)
    }
  }, [])
}

/**
 * Hook for monitoring app startup performance
 */
export function useStartupPerformance() {
  useEffect(() => {
    const startupTime = performance.now()
    
    // Wait for app to be fully loaded
    const timer = setTimeout(() => {
      const totalStartupTime = performance.now() - startupTime
      console.log(`App startup time: ${totalStartupTime.toFixed(2)}ms`)
      
      if (process.env.NODE_ENV === 'development') {
        sessionStorage.setItem('startupTime', totalStartupTime.toString())
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [])
}