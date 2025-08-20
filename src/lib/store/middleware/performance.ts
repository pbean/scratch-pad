import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { useEffect } from 'react'
import type { PerformanceMetrics, PerformanceSlice } from '../../../types/middleware'

// ============================================================================
// TYPE-SAFE PERFORMANCE MIDDLEWARE IMPLEMENTATION
// ============================================================================

type PerformanceMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs, T>
) => StateCreator<T & PerformanceSlice, Mps, Mcs, T & PerformanceSlice>

const SLOW_UPDATE_THRESHOLD = 16 // 16ms for 60fps
const MAX_TRACKED_UPDATES = 100
const PERFORMANCE_WINDOW = 30000 // 30 seconds

/**
 * Type-safe performance metrics with proper state typing
 */
interface TypedPerformanceState<T> extends T {
  _performance: PerformanceMetrics
  _getPerformanceStats: () => PerformanceMetrics & {
    averageUpdateTime: number
    recentUpdateCount: number
    rerenderPreventionRate: number
  }
  _trackRerender: (prevented: boolean) => void
  _resetPerformanceStats: () => void
}

/**
 * Enhanced performance middleware with complete type safety
 */
const performanceMiddleware: PerformanceMiddleware = (config) => (set, get, api) => {
  const initialMetrics: PerformanceMetrics = {
    totalStateUpdates: 0,
    lastUpdateTime: 0,
    updateTimes: [],
    slowUpdates: [],
    rerenderPrevention: {
      prevented: 0,
      total: 0
    }
  }

  // Type-safe wrapper for set function
  const performanceSet: typeof set = (...args) => {
    const startTime = performance.now()
    
    // Call original set function
    const result = set(...args)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Type-safe state access
    const currentState = get() as TypedPerformanceState<ReturnType<typeof get>>
    const newMetrics: PerformanceMetrics = {
      totalStateUpdates: currentState._performance.totalStateUpdates + 1,
      lastUpdateTime: endTime,
      updateTimes: [
        ...currentState._performance.updateTimes.slice(-(MAX_TRACKED_UPDATES - 1)),
        duration
      ],
      slowUpdates: duration > SLOW_UPDATE_THRESHOLD 
        ? [
            ...currentState._performance.slowUpdates.slice(-9), // Keep last 10
            { 
              timestamp: endTime, 
              duration,
              // Try to extract action name from stack trace (development only)
              action: extractActionName()
            }
          ]
        : currentState._performance.slowUpdates,
      rerenderPrevention: currentState._performance.rerenderPrevention
    }
    
    // Update performance metrics without triggering another cycle
    Object.defineProperty(api.getState(), '_performance', {
      value: newMetrics,
      writable: true,
      enumerable: false
    })
    
    return result
  }

  const baseState = config(performanceSet, get, api)
  
  return {
    ...baseState,
    _performance: initialMetrics,
    
    _getPerformanceStats: () => {
      const state = get() as TypedPerformanceState<ReturnType<typeof get>>
      const metrics = state._performance
      const now = performance.now()
      
      // Filter recent update times for better stats
      const recentUpdates = metrics.updateTimes.filter((time: number) => 
        (now - time) < PERFORMANCE_WINDOW
      )
      
      return {
        ...metrics,
        updateTimes: recentUpdates,
        averageUpdateTime: recentUpdates.length > 0 
          ? recentUpdates.reduce((sum: number, time: number) => sum + time, 0) / recentUpdates.length 
          : 0,
        recentUpdateCount: recentUpdates.length,
        rerenderPreventionRate: metrics.rerenderPrevention.total > 0 
          ? (metrics.rerenderPrevention.prevented / metrics.rerenderPrevention.total) * 100
          : 0
      }
    },
    
    _trackRerender: (prevented: boolean) => {
      const state = get() as TypedPerformanceState<ReturnType<typeof get>>
      const newMetrics: PerformanceMetrics = {
        ...state._performance,
        rerenderPrevention: {
          prevented: state._performance.rerenderPrevention.prevented + (prevented ? 1 : 0),
          total: state._performance.rerenderPrevention.total + 1
        }
      }
      
      Object.defineProperty(api.getState(), '_performance', {
        value: newMetrics,
        writable: true,
        enumerable: false
      })
    },
    
    _resetPerformanceStats: () => {
      Object.defineProperty(api.getState(), '_performance', {
        value: initialMetrics,
        writable: true,
        enumerable: false
      })
    }
  }
}

/**
 * Type-safe action name extraction from stack trace
 */
function extractActionName(): string | undefined {
  if (process.env.NODE_ENV !== 'development') return undefined
  
  try {
    const stack = new Error().stack
    if (!stack) return undefined
    
    const lines = stack.split('\n')
    // Look for function names that might be actions
    for (const line of lines.slice(2, 6)) { // Skip first 2 lines (Error and this function)
      const match = line.match(/at (\w+)/) 
      if (match && match[1] && !['Object', 'performanceSet'].includes(match[1])) {
        return match[1]
      }
    }
  } catch (error) {
    // Ignore errors in dev helper
  }
  
  return undefined
}

// ============================================================================
// TYPE-SAFE DEVELOPMENT HELPERS
// ============================================================================

/**
 * Type-safe performance logging for stores
 */
export const logPerformanceStats = <T extends PerformanceSlice>(store: T): void => {
  if (process.env.NODE_ENV !== 'development') return
  
  const stats = store._getPerformanceStats()
  
  console.group('🚀 Store Performance Stats')
  console.log('Total State Updates:', stats.totalStateUpdates)
  console.log('Average Update Time:', `${stats.averageUpdateTime?.toFixed(2)}ms`)
  console.log('Recent Updates:', stats.recentUpdateCount)
  console.log('Slow Updates:', stats.slowUpdates.length)
  console.log('Rerender Prevention Rate:', `${stats.rerenderPreventionRate?.toFixed(1)}%`)
  
  if (stats.slowUpdates.length > 0) {
    console.warn('Slow Updates Detected:')
    stats.slowUpdates.forEach(update => {
      console.warn(`  - ${update.duration.toFixed(2)}ms${update.action ? ` (${update.action})` : ''}`)
    })
  }
  
  console.groupEnd()
}

/**
 * Type-safe performance monitoring hook for React components
 */
export const usePerformanceMonitor = <T extends PerformanceSlice>(
  store: T, 
  componentName: string
): void => {
  useEffect(() => {
    let renderCount = 0
    let lastRenderTime = performance.now()
    
    const trackRender = () => {
      const now = performance.now()
      const renderTime = now - lastRenderTime
      renderCount++
      
      // Track if this render was prevented (would have been unnecessary)
      const wasPrevented = renderTime < 1 // Very fast re-renders might indicate prevented renders
      store._trackRerender(wasPrevented)
      
      if (process.env.NODE_ENV === 'development' && renderCount % 10 === 0) {
        console.log(`📊 ${componentName} - Renders: ${renderCount}, Last: ${renderTime.toFixed(2)}ms`)
      }
      
      lastRenderTime = now
    }
    
    // Track initial render
    trackRender()
    
    return () => {
      // Component unmounting
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏁 ${componentName} unmounted after ${renderCount} renders`)
      }
    }
  }, [store, componentName])
}

/**
 * Type-safe performance store interface
 */
export interface TypeSafePerformanceStore extends PerformanceSlice {
  // Additional methods for enhanced performance monitoring
  getPerformanceSnapshot: () => {
    metrics: PerformanceMetrics
    timestamp: number
    memoryInfo?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }
  }
  
  comparePerformanceSnapshots: (
    snapshot1: ReturnType<TypeSafePerformanceStore['getPerformanceSnapshot']>,
    snapshot2: ReturnType<TypeSafePerformanceStore['getPerformanceSnapshot']>
  ) => {
    updatesDiff: number
    averageTimeDiff: number
    memoryDiff?: number
  }
}

/**
 * Enhanced performance store creator with type safety
 */
export const createTypeSafePerformanceStore = <T>(
  baseStore: T & PerformanceSlice
): T & TypeSafePerformanceStore => {
  return {
    ...baseStore,
    
    getPerformanceSnapshot: () => {
      const metrics = baseStore._getPerformanceStats()
      const snapshot = {
        metrics,
        timestamp: Date.now(),
        memoryInfo: undefined as undefined | {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      
      // Safely access performance.memory if available
      if (typeof window !== 'undefined' && 'performance' in window) {
        const performance = window.performance
        if ('memory' in performance) {
          const memory = performance.memory as {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
          }
          snapshot.memoryInfo = {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          }
        }
      }
      
      return snapshot
    },
    
    comparePerformanceSnapshots: (snapshot1, snapshot2) => {
      const updatesDiff = snapshot2.metrics.totalStateUpdates - snapshot1.metrics.totalStateUpdates
      const averageTimeDiff = 
        (snapshot2.metrics.updateTimes.reduce((sum, time) => sum + time, 0) / snapshot2.metrics.updateTimes.length) -
        (snapshot1.metrics.updateTimes.reduce((sum, time) => sum + time, 0) / snapshot1.metrics.updateTimes.length)
      
      let memoryDiff: number | undefined
      if (snapshot1.memoryInfo && snapshot2.memoryInfo) {
        memoryDiff = snapshot2.memoryInfo.usedJSHeapSize - snapshot1.memoryInfo.usedJSHeapSize
      }
      
      return {
        updatesDiff,
        averageTimeDiff: isNaN(averageTimeDiff) ? 0 : averageTimeDiff,
        memoryDiff
      }
    }
  }
}

/**
 * Development performance monitoring dashboard
 */
export const startTypeSafePerformanceDashboard = <T extends PerformanceSlice>(
  store: T
): (() => void) => {
  if (process.env.NODE_ENV !== 'development') {
    return () => {} // No-op in production
  }
  
  const enhancedStore = createTypeSafePerformanceStore(store)
  let intervalId: NodeJS.Timeout
  let previousSnapshot = enhancedStore.getPerformanceSnapshot()
  
  const logDashboard = () => {
    const currentSnapshot = enhancedStore.getPerformanceSnapshot()
    const comparison = enhancedStore.comparePerformanceSnapshots(previousSnapshot, currentSnapshot)
    
    console.group('📊 Performance Dashboard Update')
    console.log('Time Range:', new Date(previousSnapshot.timestamp).toLocaleTimeString(), 
                'to', new Date(currentSnapshot.timestamp).toLocaleTimeString())
    console.log('State Updates:', comparison.updatesDiff)
    console.log('Average Time Change:', `${comparison.averageTimeDiff.toFixed(2)}ms`)
    
    if (comparison.memoryDiff !== undefined) {
      const memoryDiffMB = comparison.memoryDiff / (1024 * 1024)
      console.log('Memory Usage Change:', `${memoryDiffMB.toFixed(2)}MB`)
    }
    
    if (comparison.updatesDiff > 50) {
      console.warn('⚠️ High update frequency detected')
    }
    
    if (comparison.averageTimeDiff > 5) {
      console.warn('⚠️ Performance degradation detected')
    }
    
    console.groupEnd()
    
    previousSnapshot = currentSnapshot
  }
  
  // Log dashboard every 30 seconds
  intervalId = setInterval(logDashboard, 30000)
  
  // Return cleanup function
  return () => {
    clearInterval(intervalId)
  }
}

export default performanceMiddleware