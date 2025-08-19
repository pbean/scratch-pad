import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { useEffect } from 'react'

interface PerformanceMetrics {
  totalStateUpdates: number
  lastUpdateTime: number
  updateTimes: number[]
  slowUpdates: Array<{ timestamp: number; duration: number; action?: string }>
  rerenderPrevention: {
    prevented: number
    total: number
  }
}

interface PerformanceSlice {
  _performance: PerformanceMetrics
  _getPerformanceStats: () => PerformanceMetrics
  _trackRerender: (prevented: boolean) => void
  _resetPerformanceStats: () => void
}

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

  // Wrap the set function to track performance
  const performanceSet: typeof set = (...args) => {
    const startTime = performance.now()
    
    // Call original set function
    const result = set(...args)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Update performance metrics
    const currentState = get() as any
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
      const state = get() as any
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
      const state = get() as any
      const newMetrics = {
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

// Development helper to monitor performance
export const logPerformanceStats = (store: any) => {
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

// Performance monitoring hook for React components
export const usePerformanceMonitor = (store: any, componentName: string) => {
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
  })
}

export default performanceMiddleware