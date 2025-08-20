import { useEffect, useRef } from "react"

interface PerformanceMetrics {
  renderTime: number
  componentName: string
  timestamp: number
}

// ============================================================================
// TYPE-SAFE BROWSER API EXTENSIONS - Phase 1 Implementation
// ============================================================================

/**
 * Extended Performance interface for Chrome-specific memory API
 * Provides type-safe access to memory monitoring features
 */
interface ChromePerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

/**
 * Type guard to check if performance.memory API is available
 * Ensures type-safe access to Chrome-specific memory monitoring
 */
function hasMemoryAPI(performance: Performance): performance is ChromePerformance {
  return 'memory' in performance && 
         typeof (performance as ChromePerformance).memory === 'object' &&
         (performance as ChromePerformance).memory !== null
}

/**
 * Type-safe memory usage information
 */
interface MemoryUsage {
  used: number
  total: number
  limit: number
  timestamp: number
  usagePercent: number
}

/**
 * Type-safe memory monitoring with null safety
 * Returns structured memory data or null if API unavailable
 */
export function getMemoryUsage(): MemoryUsage | null {
  if (!hasMemoryAPI(performance)) {
    return null
  }
  
  const { memory } = performance
  if (!memory) {
    return null
  }
  
  const used = memory.usedJSHeapSize
  const total = memory.totalJSHeapSize
  const limit = memory.jsHeapSizeLimit
  
  return {
    used,
    total,
    limit,
    timestamp: Date.now(),
    usagePercent: (used / limit) * 100
  }
}

/**
 * Type guard for checking if navigation timing API is available
 */
function hasNavigationTiming(performance: Performance): performance is Performance & {
  getEntriesByType(type: 'navigation'): PerformanceNavigationTiming[]
} {
  return 'getEntriesByType' in performance &&
         typeof performance.getEntriesByType === 'function'
}

/**
 * Type-safe navigation timing information
 */
interface NavigationTiming {
  domContentLoaded: number
  loadComplete: number
  firstPaint?: number
  firstContentfulPaint?: number
}

/**
 * Get type-safe navigation timing metrics
 */
export function getNavigationTiming(): NavigationTiming | null {
  if (!hasNavigationTiming(performance)) {
    return null
  }
  
  const entries = performance.getEntriesByType('navigation')
  if (entries.length === 0) {
    return null
  }
  
  const navigation = entries[0] as PerformanceNavigationTiming
  
  // Get paint timing if available
  const paintEntries = performance.getEntriesByType('paint')
  const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')?.startTime
  const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime
  
  return {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    firstPaint,
    firstContentfulPaint
  }
}

/**
 * Hook for monitoring component render performance with type safety
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

    // Store metrics for debugging with type safety
    if (process.env.NODE_ENV === 'development') {
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      }
      
      // Store in sessionStorage for debugging
      try {
        const existingMetrics = JSON.parse(sessionStorage.getItem('renderMetrics') || '[]') as PerformanceMetrics[]
        existingMetrics.push(metrics)
        
        // Keep only last 100 metrics
        if (existingMetrics.length > 100) {
          existingMetrics.splice(0, existingMetrics.length - 100)
        }
        
        sessionStorage.setItem('renderMetrics', JSON.stringify(existingMetrics))
      } catch (error) {
        console.warn('Failed to store render metrics:', error)
      }
    }
  })
}

/**
 * Hook for monitoring memory usage with type-safe browser API access
 */
export function useMemoryMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkMemory = () => {
        const memoryUsage = getMemoryUsage()
        
        if (memoryUsage) {
          const usedMB = Math.round(memoryUsage.used / 1024 / 1024)
          const limitMB = Math.round(memoryUsage.limit / 1024 / 1024)
          
          // Warn if memory usage is high (>100MB or >75% of limit)
          if (usedMB > 100 || memoryUsage.usagePercent > 75) {
            console.warn(`High memory usage: ${usedMB}MB / ${limitMB}MB (${memoryUsage.usagePercent.toFixed(1)}%)`)
          }
          
          // Store metrics with type safety
          try {
            sessionStorage.setItem('memoryMetrics', JSON.stringify({
              used: usedMB,
              total: Math.round(memoryUsage.total / 1024 / 1024),
              limit: limitMB,
              usagePercent: memoryUsage.usagePercent,
              timestamp: memoryUsage.timestamp
            }))
          } catch (error) {
            console.warn('Failed to store memory metrics:', error)
          }
        } else {
          // API not available, store placeholder
          try {
            sessionStorage.setItem('memoryMetrics', JSON.stringify({
              available: false,
              timestamp: Date.now()
            }))
          } catch (error) {
            console.warn('Failed to store memory availability info:', error)
          }
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
 * Hook for monitoring app startup performance with comprehensive timing
 */
export function useStartupPerformance() {
  useEffect(() => {
    const startupTime = performance.now()
    
    // Wait for app to be fully loaded
    const timer = setTimeout(() => {
      const totalStartupTime = performance.now() - startupTime
      console.log(`App startup time: ${totalStartupTime.toFixed(2)}ms`)
      
      // Get comprehensive timing information
      const navigationTiming = getNavigationTiming()
      const memoryUsage = getMemoryUsage()
      
      if (process.env.NODE_ENV === 'development') {
        try {
          const startupMetrics = {
            totalStartupTime,
            navigationTiming,
            memoryUsage: memoryUsage ? {
              usedMB: Math.round(memoryUsage.used / 1024 / 1024),
              usagePercent: memoryUsage.usagePercent
            } : null,
            timestamp: Date.now()
          }
          
          sessionStorage.setItem('startupMetrics', JSON.stringify(startupMetrics))
        } catch (error) {
          console.warn('Failed to store startup metrics:', error)
        }
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [])
}

/**
 * Advanced performance monitoring hook with comprehensive metrics
 */
export function useAdvancedPerformanceMonitoring(componentName: string) {
  const renderStartTime = useRef<number>(0)
  const mountTime = useRef<number>(Date.now())
  
  useEffect(() => {
    renderStartTime.current = performance.now()
  })
  
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current
    const memoryUsage = getMemoryUsage()
    
    if (process.env.NODE_ENV === 'development') {
      const metrics = {
        componentName,
        renderTime,
        memoryUsage: memoryUsage ? Math.round(memoryUsage.used / 1024 / 1024) : null,
        timestamp: Date.now(),
        mountDuration: Date.now() - mountTime.current
      }
      
      // Log performance warnings
      if (renderTime > 16) {
        console.warn(`🐌 Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }
      
      if (memoryUsage && memoryUsage.usagePercent > 80) {
        console.warn(`🧠 High memory usage in ${componentName}: ${memoryUsage.usagePercent.toFixed(1)}%`)
      }
      
      // Store comprehensive metrics
      try {
        const existingMetrics = JSON.parse(sessionStorage.getItem('advancedMetrics') || '[]')
        existingMetrics.push(metrics)
        
        // Keep only last 50 metrics to prevent storage bloat
        if (existingMetrics.length > 50) {
          existingMetrics.splice(0, existingMetrics.length - 50)
        }
        
        sessionStorage.setItem('advancedMetrics', JSON.stringify(existingMetrics))
      } catch (error) {
        console.warn('Failed to store advanced metrics:', error)
      }
    }
  })
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        const unmountTime = Date.now()
        const totalLifetime = unmountTime - mountTime.current
        
        console.log(`📊 Component ${componentName} lifetime: ${totalLifetime}ms`)
      }
    }
  }, [componentName])
}