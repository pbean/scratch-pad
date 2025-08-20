import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { 
  TypeSafeDevtoolsConfig, 
  TypeSafeReplacer, 
  TypeSafeReviver,
  DevtoolsAction,
  NoteActionPayload,
  SearchActionPayload,
  UIActionPayload,
  SettingsActionPayload,
  SystemActionPayload,
  PerformanceActionPayload,
  SerializationContext,
  JSONSerializable,
  TypeSafePredicate
} from '../../../types/middleware'
import type { Note, Settings } from '../../../types'

// ============================================================================
// TYPE-SAFE DEVTOOLS IMPLEMENTATION
// ============================================================================

/**
 * Enhanced devtools middleware with complete type safety
 */
type TypeSafeDevtoolsMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>,
  options?: TypeSafeDevtoolsConfig
) => StateCreator<T, Mps, [...Mcs, ['zustand/devtools', never]]>

/**
 * Create type-safe serializer for complex objects
 */
const createTypeSafeSerializer = () => {
  const createReplacer = (): TypeSafeReplacer => {
    return (key: string, value: unknown, context: SerializationContext): JSONSerializable | undefined => {
      // Prevent infinite recursion
      if (context.depth > 10) {
        return '[Max Depth Reached]'
      }

      // Handle primitive types
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value as JSONSerializable
      }

      // Handle undefined
      if (value === undefined) {
        return null
      }

      // Handle functions
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`
      }

      // Handle symbols
      if (typeof value === 'symbol') {
        return `[Symbol: ${value.toString()}]`
      }

      // Handle object types
      if (typeof value === 'object') {
        // Check for circular references
        if (context.visited.has(value)) {
          return '[Circular Reference]'
        }

        context.visited.add(value)

        try {
          // Handle Set objects
          if (value instanceof Set) {
            return {
              __type: 'Set',
              value: Array.from(value).map(item => 
                createReplacer()(key, item, { ...context, depth: context.depth + 1 })
              )
            } as JSONSerializable
          }
          
          // Handle Map objects
          if (value instanceof Map) {
            return {
              __type: 'Map',
              value: Array.from(value.entries()).map(([k, v]) => [
                createReplacer()(key, k, { ...context, depth: context.depth + 1 }),
                createReplacer()(key, v, { ...context, depth: context.depth + 1 })
              ])
            } as JSONSerializable
          }
          
          // Handle Date objects
          if (value instanceof Date) {
            return {
              __type: 'Date',
              value: value.toISOString()
            } as JSONSerializable
          }

          // Handle Error objects
          if (value instanceof Error) {
            return {
              __type: 'Error',
              value: {
                name: value.name,
                message: value.message,
                stack: value.stack
              }
            } as JSONSerializable
          }
          
          // Handle performance data (filter in production)
          if (key === '_performance' && process.env.NODE_ENV === 'production') {
            return '[Performance Data - Hidden in Production]'
          }
          
          // Handle regular objects and arrays
          if (Array.isArray(value)) {
            return value.map(item => 
              createReplacer()(key, item, { ...context, depth: context.depth + 1 })
            ) as JSONSerializable
          }

          // Handle plain objects
          const result: Record<string, JSONSerializable> = {}
          for (const [objKey, objValue] of Object.entries(value)) {
            const serialized = createReplacer()(objKey, objValue, { ...context, depth: context.depth + 1 })
            if (serialized !== undefined) {
              result[objKey] = serialized
            }
          }
          return result
        } finally {
          context.visited.delete(value)
        }
      }

      return undefined
    }
  }

  const createReviver = (): TypeSafeReviver => {
    return (key: string, value: JSONSerializable): unknown => {
      // Handle primitive types
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
      }

      // Handle special object types
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, JSONSerializable>
        
        // Restore Set objects
        if (obj.__type === 'Set' && Array.isArray(obj.value)) {
          return new Set(obj.value.map(item => createReviver()(key, item)))
        }
        
        // Restore Map objects
        if (obj.__type === 'Map' && Array.isArray(obj.value)) {
          const entries = obj.value as Array<[JSONSerializable, JSONSerializable]>
          return new Map(entries.map(([k, v]) => [
            createReviver()(key, k),
            createReviver()(key, v)
          ]))
        }
        
        // Restore Date objects
        if (obj.__type === 'Date' && typeof obj.value === 'string') {
          return new Date(obj.value)
        }

        // Restore Error objects
        if (obj.__type === 'Error' && typeof obj.value === 'object') {
          const errorData = obj.value as Record<string, string>
          const error = new Error(errorData.message)
          error.name = errorData.name
          error.stack = errorData.stack
          return error
        }
      }

      // Handle arrays
      if (Array.isArray(value)) {
        return value.map(item => createReviver()(key, item))
      }
      
      return value
    }
  }

  return {
    replacer: createReplacer(),
    reviver: createReviver()
  }
}

/**
 * Create slice-specific devtools configuration with type safety
 */
export const createTypeSafeDevtoolsConfig = (sliceName: string): TypeSafeDevtoolsConfig => {
  const serializer = createTypeSafeSerializer()
  
  return {
    name: `ScratchPad-${sliceName}`,
    enabled: process.env.NODE_ENV === 'development',
    serialize: {
      options: {
        undefined: true,
        function: true,
        symbol: true
      },
      replacer: (key: string, value: unknown) => {
        return serializer.replacer(key, value, { depth: 0, visited: new WeakSet() })
      },
      reviver: serializer.reviver
    },
    trace: process.env.NODE_ENV === 'development',
    traceLimit: 25,
    predicate: createActionPredicate()
  }
}

/**
 * Type-safe predicate for filtering devtools actions
 */
const createActionPredicate = (): TypeSafePredicate => {
  return <T>(state: T, action: DevtoolsAction): boolean => {
    if (process.env.NODE_ENV === 'production') {
      // Filter out performance actions in production
      return action.type !== 'performance_action'
    }
    return true
  }
}

/**
 * Enhanced devtools middleware with complete type safety
 */
export const createEnhancedDevtools = <T>(
  sliceName: string,
  options?: Partial<TypeSafeDevtoolsConfig>
): TypeSafeDevtoolsMiddleware => {
  const config: TypeSafeDevtoolsConfig = {
    ...createTypeSafeDevtoolsConfig(sliceName),
    ...options
  }
  
  return (stateCreator) => {
    if (!config.enabled) {
      // Return original state creator if devtools disabled
      return stateCreator
    }
    
    // Type-safe devtools integration
    return devtools(stateCreator, {
      name: config.name,
      enabled: config.enabled,
      serialize: config.serialize as any, // Zustand types are not fully compatible
      actionCreators: config.actionCreators as any,
      latency: config.latency,
      predicate: config.predicate as any,
      trace: config.trace,
      traceLimit: config.traceLimit
    })
  }
}

/**
 * Type-safe action creators for better debugging
 */
export const createTypeSafeActionCreators = (sliceName: string) => {
  const creators = {
    // Notes actions
    [`${sliceName}_setActiveNote`]: (noteId: number | null): DevtoolsAction => ({
      type: 'note_action',
      payload: { action: 'set_active', noteId }
    }),
    
    [`${sliceName}_createNote`]: (content?: string): DevtoolsAction => ({
      type: 'note_action',
      payload: { action: 'create', content }
    }),
    
    [`${sliceName}_updateNote`]: (note: Note): DevtoolsAction => ({
      type: 'note_action',
      payload: { action: 'update', noteId: note.id, content: note.content }
    }),
    
    [`${sliceName}_deleteNote`]: (noteId: number): DevtoolsAction => ({
      type: 'note_action',
      payload: { action: 'delete', noteId }
    }),
    
    // Search actions
    [`${sliceName}_searchNotes`]: (query: string): DevtoolsAction => ({
      type: 'search_action',
      payload: { action: 'search', query }
    }),
    
    [`${sliceName}_clearSearch`]: (): DevtoolsAction => ({
      type: 'search_action',
      payload: { action: 'clear' }
    }),
    
    // UI actions
    [`${sliceName}_setView`]: (view: string): DevtoolsAction => ({
      type: 'ui_action',
      payload: { action: 'set_view', view }
    }),
    
    [`${sliceName}_setError`]: (error: string | null): DevtoolsAction => ({
      type: 'ui_action',
      payload: { action: 'set_error', error: error || undefined }
    }),
    
    [`${sliceName}_toggleCommandPalette`]: (): DevtoolsAction => ({
      type: 'ui_action',
      payload: { action: 'toggle_sidebar' }
    }),
    
    // Settings actions
    [`${sliceName}_updateSettings`]: (settings: Partial<Settings>): DevtoolsAction => ({
      type: 'settings_action',
      payload: { action: 'update', settings }
    }),
    
    [`${sliceName}_saveSettings`]: (): DevtoolsAction => ({
      type: 'settings_action',
      payload: { action: 'save' }
    }),
    
    // System actions
    [`${sliceName}_healthCheck`]: (): DevtoolsAction => ({
      type: 'system_action',
      payload: { action: 'health_check' }
    }),
    
    [`${sliceName}_updateConnection`]: (status: string): DevtoolsAction => ({
      type: 'system_action',
      payload: { action: 'update_connection', status }
    })
  }

  // Return with proper typing
  return creators as Record<string, (...args: unknown[]) => DevtoolsAction>
}

/**
 * Development helper for logging state changes with type safety
 */
export const createTypeSafeStateLogger = (sliceName: string) => {
  if (process.env.NODE_ENV !== 'development') {
    return () => {} // No-op in production
  }
  
  let previousState: unknown = null
  
  return <T>(state: T, actionName?: string): void => {
    if (!previousState) {
      previousState = state
      return
    }
    
    // Type-safe change detection
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    
    if (typeof state === 'object' && state !== null && typeof previousState === 'object' && previousState !== null) {
      const stateObj = state as Record<string, unknown>
      const prevObj = previousState as Record<string, unknown>
      
      for (const key in stateObj) {
        if (stateObj[key] !== prevObj[key]) {
          changes[key] = {
            from: prevObj[key],
            to: stateObj[key]
          }
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
    
    previousState = structuredClone(state) // Deep clone for accurate comparison
  }
}

/**
 * Type-safe time travel debugging helpers
 */
export interface TypeSafeTimeTravel<T> {
  saveState: (state: T, action?: string) => void
  getHistory: () => Array<{ state: T; timestamp: number; action?: string }>
  restoreState: (index: number) => void
  clearHistory: () => void
}

export const createTypeSafeTimeTravel = <T>(
  store: { setState: (state: T) => void }
): TypeSafeTimeTravel<T> => {
  if (process.env.NODE_ENV !== 'development') {
    return {
      saveState: () => {},
      getHistory: () => [],
      restoreState: () => {},
      clearHistory: () => {}
    }
  }
  
  const history: Array<{ state: T; timestamp: number; action?: string }> = []
  const MAX_HISTORY = 50
  
  return {
    saveState: (state: T, action?: string) => {
      history.push({
        state: structuredClone(state), // Deep clone
        timestamp: Date.now(),
        action
      })
      
      if (history.length > MAX_HISTORY) {
        history.shift()
      }
    },
    
    getHistory: () => [...history], // Return copy
    
    restoreState: (index: number) => {
      if (index >= 0 && index < history.length) {
        const historicalState = history[index]
        console.log(`🕰️ Restoring state from ${new Date(historicalState.timestamp).toLocaleTimeString()}`)
        store.setState(historicalState.state)
      }
    },
    
    clearHistory: () => {
      history.length = 0
    }
  }
}

/**
 * Type-safe performance monitoring integration
 */
export const integrateTypeSafePerformanceMonitoring = <T>(
  store: { setState: (...args: unknown[]) => unknown; _getPerformanceStats?: () => Record<string, number> }
): void => {
  if (process.env.NODE_ENV !== 'development') return
  
  // Monitor slow state updates with type safety
  const originalSetState = store.setState
  
  store.setState = (...args: unknown[]) => {
    const startTime = performance.now()
    const result = originalSetState.apply(store, args)
    const duration = performance.now() - startTime
    
    if (duration > 16) { // Slower than 60fps
      console.warn(`🐌 Slow state update detected: ${duration.toFixed(2)}ms`)
    }
    
    return result
  }
  
  // Add performance panel data with type safety
  if (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
    const interval = setInterval(() => {
      const stats = store._getPerformanceStats?.()
      if (stats) {
        console.log('📊 Performance Stats:', stats)
      }
    }, 10000) // Every 10 seconds
    
    // Cleanup interval when needed
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        clearInterval(interval)
      })
    }
  }
}

export default createEnhancedDevtools