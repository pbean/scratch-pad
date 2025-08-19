import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { devtools } from 'zustand/middleware'

interface DevtoolsConfig {
  name?: string
  enabled?: boolean
  serialize?: boolean | { 
    options?: any
    replacer?: (key: string, value: any) => any
    reviver?: (key: string, value: any) => any
  }
  actionCreators?: Record<string, (...args: any[]) => any>
  latency?: number
  predicate?: (state: any, action: any) => boolean
  trace?: boolean
  traceLimit?: number
}

// Enhanced devtools middleware with better action tracking
type DevtoolsMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>,
  options?: DevtoolsConfig
) => StateCreator<T, Mps, [...Mcs, ['zustand/devtools', never]]>

// Custom serializer to handle complex objects like Sets and Maps
const createSerializer = () => ({
  replacer: (key: string, value: any) => {
    // Handle Set objects
    if (value instanceof Set) {
      return {
        __type: 'Set',
        value: Array.from(value)
      }
    }
    
    // Handle Map objects
    if (value instanceof Map) {
      return {
        __type: 'Map',
        value: Array.from(value.entries())
      }
    }
    
    // Handle performance data (don't serialize in production)
    if (key === '_performance' && process.env.NODE_ENV === 'production') {
      return '[Performance Data - Hidden in Production]'
    }
    
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (value.__serialized) {
        return '[Circular Reference]'
      }
      value.__serialized = true
    }
    
    return value
  },
  
  reviver: (key: string, value: any) => {
    // Restore Set objects
    if (value && value.__type === 'Set') {
      return new Set(value.value)
    }
    
    // Restore Map objects
    if (value && value.__type === 'Map') {
      return new Map(value.value)
    }
    
    return value
  }
})

// Create slice-specific devtools configuration
export const createDevtoolsConfig = (sliceName: string): DevtoolsConfig => ({
  name: `ScratchPad-${sliceName}`,
  enabled: process.env.NODE_ENV === 'development',
  serialize: {
    options: {
      undefined: true,
      function: true,
      symbol: true
    },
    ...createSerializer()
  },
  trace: process.env.NODE_ENV === 'development',
  traceLimit: 25,
  // Filter out performance-related actions in production
  predicate: (state: any, action: any) => {
    if (process.env.NODE_ENV === 'production') {
      return !action.type?.includes('_performance')
    }
    return true
  }
})

// Enhanced devtools middleware with action tracking
export const createEnhancedDevtools = <T>(
  sliceName: string,
  options?: Partial<DevtoolsConfig>
): DevtoolsMiddleware => {
  const config = {
    ...createDevtoolsConfig(sliceName),
    ...options
  }
  
  return (stateCreator) => {
    if (!config.enabled) {
      // Return original state creator if devtools disabled
      return stateCreator
    }
    
    return devtools(stateCreator, config) as any
  }
}

// Action creators for better debugging
export const createActionCreators = (sliceName: string) => ({
  // Notes actions
  [`${sliceName}_setActiveNote`]: (noteId: number | null) => ({ noteId }),
  [`${sliceName}_createNote`]: (content?: string) => ({ content }),
  [`${sliceName}_updateNote`]: (note: any) => ({ note }),
  [`${sliceName}_deleteNote`]: (noteId: number) => ({ noteId }),
  
  // Search actions
  [`${sliceName}_searchNotes`]: (query: string) => ({ query }),
  [`${sliceName}_clearSearch`]: () => ({}),
  
  // UI actions
  [`${sliceName}_setView`]: (view: string) => ({ view }),
  [`${sliceName}_setError`]: (error: string | null) => ({ error }),
  [`${sliceName}_toggleCommandPalette`]: () => ({}),
  
  // Settings actions
  [`${sliceName}_updateSettings`]: (settings: any) => ({ settings }),
  [`${sliceName}_saveSettings`]: () => ({}),
  
  // System actions
  [`${sliceName}_healthCheck`]: () => ({}),
  [`${sliceName}_updateConnection`]: (status: string) => ({ status })
})

// Development helper to log state changes
export const createStateLogger = (sliceName: string) => {
  if (process.env.NODE_ENV !== 'development') {
    return () => {} // No-op in production
  }
  
  let previousState: any = null
  
  return (state: any, actionName?: string) => {
    if (!previousState) {
      previousState = state
      return
    }
    
    // Find what changed
    const changes: Record<string, { from: any; to: any }> = {}
    
    for (const key in state) {
      if (state[key] !== previousState[key]) {
        changes[key] = {
          from: previousState[key],
          to: state[key]
        }
      }
    }
    
    if (Object.keys(changes).length > 0) {
      console.group(`🏪 ${sliceName} State Change${actionName ? ` (${actionName})` : ''}`)
      
      Object.entries(changes).forEach(([key, change]) => {
        console.log(`${key}:`, change.from, '→', change.to)
      })
      
      console.groupEnd()
    }
    
    previousState = { ...state }
  }
}

// Time travel debugging helpers
export const createTimeTravel = (store: any) => {
  if (process.env.NODE_ENV !== 'development') {
    return {}
  }
  
  const history: Array<{ state: any; timestamp: number; action?: string }> = []
  const MAX_HISTORY = 50
  
  return {
    saveState: (state: any, action?: string) => {
      history.push({
        state: JSON.parse(JSON.stringify(state)), // Deep clone
        timestamp: Date.now(),
        action
      })
      
      if (history.length > MAX_HISTORY) {
        history.shift()
      }
    },
    
    getHistory: () => history,
    
    restoreState: (index: number) => {
      if (index >= 0 && index < history.length) {
        const historicalState = history[index]
        console.log(`🕰️ Restoring state from ${new Date(historicalState.timestamp).toLocaleTimeString()}`)
        
        // This would require the store to have a reset method
        if (typeof store.setState === 'function') {
          store.setState(historicalState.state)
        }
      }
    },
    
    clearHistory: () => {
      history.length = 0
    }
  }
}

// Performance monitoring integration with devtools
export const integratePerformanceMonitoring = (store: any) => {
  if (process.env.NODE_ENV !== 'development') return
  
  // Monitor slow state updates
  const originalSetState = store.setState
  
  store.setState = (...args: any[]) => {
    const startTime = performance.now()
    const result = originalSetState.apply(store, args)
    const duration = performance.now() - startTime
    
    if (duration > 16) { // Slower than 60fps
      console.warn(`🐌 Slow state update detected: ${duration.toFixed(2)}ms`)
    }
    
    return result
  }
  
  // Add performance panel data
  if (window.__REDUX_DEVTOOLS_EXTENSION__) {
    setInterval(() => {
      const stats = store._getPerformanceStats?.()
      if (stats) {
        console.log('📊 Performance Stats:', stats)
      }
    }, 10000) // Every 10 seconds
  }
}

export default createEnhancedDevtools