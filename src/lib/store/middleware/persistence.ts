import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  PersistenceConfig,
  TypeSafePartializer,
  TypeSafeMerger,
  TypeSafeMigrator,
  TypeSafeStorage,
  TypeSafeRehydrationHandler,
  SlicePersistenceType,
  PersistenceStateMap,
  UIPersistedState,
  SearchPersistedState,
  NotesPersistedState,
  SettingsPersistedState,
  SystemPersistedState
} from '../../../types/middleware'
import type { LayoutMode } from '../../../types'

// ============================================================================
// TYPE-SAFE PERSISTENCE IMPLEMENTATION
// ============================================================================

/**
 * Enhanced persistence middleware with complete type safety
 */
type TypeSafePersistenceMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, [...Mcs, ['zustand/persist', unknown]]>

/**
 * Type-safe storage adapter with error handling
 */
const createTypeSafeStorage = (): TypeSafeStorage => {
  return {
    getItem: (name: string): string | null => {
      try {
        return localStorage.getItem(name)
      } catch (error) {
        console.warn(`Failed to read from localStorage for key: ${name}`, error)
        return null
      }
    },
    
    setItem: (name: string, value: string): void => {
      try {
        localStorage.setItem(name, value)
      } catch (error) {
        console.warn(`Failed to write to localStorage for key: ${name}`, error)
        
        // Handle quota exceeded or other localStorage errors
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          // Try to clear old data
          clearOldPersistenceData()
          
          // Retry once after cleanup
          try {
            localStorage.setItem(name, value)
          } catch (retryError) {
            console.error(`Failed to write to localStorage after cleanup for key: ${name}`, retryError)
          }
        }
      }
    },
    
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name)
      } catch (error) {
        console.warn(`Failed to remove from localStorage for key: ${name}`, error)
      }
    }
  }
}

/**
 * Clean up old persistence data to free up space
 */
const clearOldPersistenceData = (): void => {
  try {
    const keys = Object.keys(localStorage)
    const scratchPadKeys = keys.filter(key => key.startsWith('scratch-pad-'))
    
    // Keep only the most recent data, clear performance and temporary data
    scratchPadKeys.forEach(key => {
      if (key.includes('search') || key.includes('performance') || key.includes('temp')) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.warn('Failed to clear old persistence data', error)
  }
}

// ============================================================================
// TYPE-SAFE SLICE CONFIGURATION CREATORS
// ============================================================================

/**
 * Type-safe UI persistence configuration
 */
const createUIPartializer = (): TypeSafePartializer<UIPersistedState> => {
  return (state: UIPersistedState): UIPersistedState => ({
    currentView: typeof state.currentView === 'string' ? state.currentView : 'notes',
    expandedFolders: Array.isArray(state.expandedFolders) 
      ? state.expandedFolders 
      : [],
    sidebarWidth: typeof state.sidebarWidth === 'number' ? state.sidebarWidth : 250,
    isFullscreen: typeof state.isFullscreen === 'boolean' ? state.isFullscreen : false
  })
}

const createUIMerger = (): TypeSafeMerger<UIPersistedState> => {
  return (persistedState: UIPersistedState, currentState: UIPersistedState): UIPersistedState => ({
    ...currentState,
    currentView: persistedState.currentView,
    expandedFolders: persistedState.expandedFolders || [],
    sidebarWidth: persistedState.sidebarWidth,
    isFullscreen: persistedState.isFullscreen
  })
}

/**
 * Type-safe Search persistence configuration
 */
const createSearchPartializer = (): TypeSafePartializer<SearchPersistedState> => {
  return (state: SearchPersistedState): SearchPersistedState => ({
    recentSearches: Array.isArray(state.recentSearches) 
      ? state.recentSearches.slice(0, 10) 
      : [],
    searchHistory: Array.isArray(state.searchHistory) 
      ? state.searchHistory.slice(0, 10) 
      : []
  })
}

const createSearchMerger = (): TypeSafeMerger<SearchPersistedState> => {
  return (persistedState: SearchPersistedState, currentState: SearchPersistedState): SearchPersistedState => ({
    ...currentState,
    recentSearches: persistedState.recentSearches || [],
    searchHistory: persistedState.searchHistory || []
  })
}

/**
 * Type-safe Notes persistence configuration
 */
const createNotesPartializer = (): TypeSafePartializer<NotesPersistedState> => {
  return (state: NotesPersistedState): NotesPersistedState => ({
    activeNoteId: typeof state.activeNoteId === 'number' || state.activeNoteId === null 
      ? state.activeNoteId 
      : null
  })
}

const createNotesMerger = (): TypeSafeMerger<NotesPersistedState> => {
  return (persistedState: NotesPersistedState, currentState: NotesPersistedState): NotesPersistedState => ({
    ...currentState,
    activeNoteId: persistedState.activeNoteId
  })
}

/**
 * Type-safe Settings persistence configuration
 */
const createSettingsPartializer = (): TypeSafePartializer<SettingsPersistedState> => {
  return (_state: SettingsPersistedState): SettingsPersistedState => ({
    isDirty: false // Always reset dirty flag on load
  })
}

const createSettingsMerger = (): TypeSafeMerger<SettingsPersistedState> => {
  return (persistedState: SettingsPersistedState, currentState: SettingsPersistedState): SettingsPersistedState => ({
    ...currentState,
    isDirty: persistedState.isDirty
  })
}

/**
 * Type-safe System persistence configuration
 */
const createSystemPartializer = (): TypeSafePartializer<SystemPersistedState> => {
  return (state: SystemPersistedState): SystemPersistedState => ({
    layoutMode: (['default', 'compact', 'expanded', 'fullscreen', 'half'] as const).includes(state.layoutMode) 
      ? state.layoutMode as LayoutMode 
      : 'default',
    isAlwaysOnTop: typeof state.isAlwaysOnTop === 'boolean' ? state.isAlwaysOnTop : false
  })
}

const createSystemMerger = (): TypeSafeMerger<SystemPersistedState> => {
  return (persistedState: SystemPersistedState, currentState: SystemPersistedState): SystemPersistedState => ({
    ...currentState,
    layoutMode: persistedState.layoutMode,
    isAlwaysOnTop: persistedState.isAlwaysOnTop
  })
}

// ============================================================================
// TYPE-SAFE CONFIGURATION FACTORY
// ============================================================================

/**
 * Configuration factory for each slice type with complete type safety
 */
const createSliceConfig = <K extends SlicePersistenceType>(
  sliceType: K
): PersistenceConfig<PersistenceStateMap[K]> => {
  const baseConfig = {
    version: 1,
    storage: createTypeSafeStorage()
  }

  switch (sliceType) {
    case 'ui':
      return {
        ...baseConfig,
        name: 'scratch-pad-ui',
        partialize: createUIPartializer() as TypeSafePartializer<PersistenceStateMap[K]>,
        merge: createUIMerger() as TypeSafeMerger<PersistenceStateMap[K]>
      }

    case 'search':
      return {
        ...baseConfig,
        name: 'scratch-pad-search',
        partialize: createSearchPartializer() as TypeSafePartializer<PersistenceStateMap[K]>,
        merge: createSearchMerger() as TypeSafeMerger<PersistenceStateMap[K]>
      }

    case 'notes':
      return {
        ...baseConfig,
        name: 'scratch-pad-notes',
        partialize: createNotesPartializer() as TypeSafePartializer<PersistenceStateMap[K]>,
        merge: createNotesMerger() as TypeSafeMerger<PersistenceStateMap[K]>
      }

    case 'settings':
      return {
        ...baseConfig,
        name: 'scratch-pad-settings',
        partialize: createSettingsPartializer() as TypeSafePartializer<PersistenceStateMap[K]>,
        merge: createSettingsMerger() as TypeSafeMerger<PersistenceStateMap[K]>
      }

    case 'system':
      return {
        ...baseConfig,
        name: 'scratch-pad-system',
        partialize: createSystemPartializer() as TypeSafePartializer<PersistenceStateMap[K]>,
        merge: createSystemMerger() as TypeSafeMerger<PersistenceStateMap[K]>
      }

    default:
      // TypeScript exhaustiveness check
      const exhaustiveCheck: never = sliceType
      throw new Error(`Unknown slice type: ${exhaustiveCheck}`)
  }
}

/**
 * Create selective persistence based on slice type with complete type safety
 */
export const createTypeSafePersistenceMiddleware = <T>(
  sliceType: SlicePersistenceType
): TypeSafePersistenceMiddleware => {
  const config = createSliceConfig(sliceType)
  
  return (stateCreator) => {
    return persist(stateCreator, {
      name: config.name,
      version: config.version,
      // Type assertion needed due to Zustand's internal typing limitations
      partialize: config.partialize as (state: T) => Partial<T>,
      merge: config.merge as (persistedState: Partial<T>, currentState: T) => T,
      migrate: config.migrate as ((persistedState: unknown, version: number) => T | Promise<T>) | undefined,
      storage: createJSONStorage(() => config.storage as any),
      onRehydrateStorage: config.onRehydrateStorage as any
    })
  }
}

// ============================================================================
// TYPE-SAFE MIGRATION SYSTEM
// ============================================================================

/**
 * Type-safe migration system with proper error handling
 */
export const createTypeSafeMigration = <T>(
  migrations: Record<number, TypeSafeMigrator<T>>
): TypeSafeMigrator<T> => {
  return (persistedState: unknown, version: number): T => {
    let migratedState = persistedState
    
    // Apply migrations in order from current version to latest
    const migrationKeys = Object.keys(migrations).map(Number).sort()
    
    for (const targetVersion of migrationKeys) {
      if (targetVersion > version && migrations[targetVersion]) {
        try {
          migratedState = migrations[targetVersion](migratedState, version)
        } catch (error) {
          console.error(`Failed to migrate to version ${targetVersion}:`, error)
          // Return original state if migration fails
          break
        }
      }
    }
    
    return migratedState as T
  }
}

/**
 * Type-safe rehydration handler with enhanced error reporting
 */
export const createTypeSafeRehydrationHandler = <T>(
  onSuccess?: (state: T) => void,
  onError?: (error: Error) => void
): TypeSafeRehydrationHandler<T> => {
  return (_state?: T) => {
    return (rehydratedState?: T, error?: Error) => {
      if (error) {
        console.error('Rehydration error:', error)
        onError?.(error)
      } else if (rehydratedState) {
        console.log('Rehydration successful')
        onSuccess?.(rehydratedState)
      }
    }
  }
}

// ============================================================================
// STORAGE UTILITIES WITH TYPE SAFETY
// ============================================================================

/**
 * Utility to manually clear all persistence data with type safety
 */
export const clearAllTypeSafePersistence = (): void => {
  const persistenceKeys: Array<keyof PersistenceStateMap> = [
    'ui',
    'search', 
    'notes',
    'settings',
    'system'
  ]
  
  persistenceKeys.forEach(key => {
    try {
      localStorage.removeItem(`scratch-pad-${key}`)
    } catch (error) {
      console.warn(`Failed to clear persistence for ${key}`, error)
    }
  })
}

/**
 * Storage health check with detailed reporting
 */
export interface StorageHealthReport {
  healthy: boolean
  available: number
  used: number
  usagePercent: number
  canWrite: boolean
  details: {
    localStorage: boolean
    quotaExceeded: boolean
    permissions: boolean
  }
}

export const checkTypeSafeStorageHealth = (): StorageHealthReport => {
  let healthy = false
  let canWrite = false
  let available = 0
  let used = 0
  const details = {
    localStorage: false,
    quotaExceeded: false,
    permissions: false
  }

  try {
    // Test localStorage availability
    details.localStorage = typeof Storage !== 'undefined' && window.localStorage !== undefined
    
    if (details.localStorage) {
      // Test write permissions
      const testKey = 'storage-health-test'
      const testValue = 'test'
      
      localStorage.setItem(testKey, testValue)
      const retrieved = localStorage.getItem(testKey)
      localStorage.removeItem(testKey)
      
      canWrite = retrieved === testValue
      details.permissions = canWrite
      
      // Calculate storage usage
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length
        }
      }
      
      // Most browsers limit localStorage to ~5-10MB
      available = 10 * 1024 * 1024 // Assume 10MB limit
      healthy = true
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      details.quotaExceeded = true
    }
    console.warn('Storage health check failed:', error)
  }

  const usagePercent = available > 0 ? (used / available) * 100 : 0

  return {
    healthy,
    available,
    used,
    usagePercent,
    canWrite,
    details
  }
}

/**
 * Development helper to inspect persisted data with type safety
 */
export const inspectTypeSafePersistedData = (): void => {
  if (process.env.NODE_ENV !== 'development') return
  
  console.group('🗄️ Type-Safe Persisted Store Data')
  
  const persistenceKeys: Array<keyof PersistenceStateMap> = [
    'ui',
    'search',
    'notes', 
    'settings',
    'system'
  ]
  
  persistenceKeys.forEach(key => {
    const storageKey = `scratch-pad-${key}`
    try {
      const data = localStorage.getItem(storageKey)
      if (data) {
        const parsed = JSON.parse(data)
        console.log(`${storageKey}:`, parsed)
      } else {
        console.log(`${storageKey}: No data`)
      }
    } catch (error) {
      console.warn(`${storageKey}: Parse error`, error)
    }
  })
  
  const health = checkTypeSafeStorageHealth()
  console.log('Storage Health:', health)
  
  if (health.usagePercent > 80) {
    console.warn('🚨 Storage usage is high:', `${health.usagePercent.toFixed(1)}%`)
  }
  
  console.groupEnd()
}

/**
 * Automatic storage cleanup when usage is high
 */
export const setupAutoStorageCleanup = (): void => {
  if (typeof window === 'undefined') return

  const checkAndCleanup = () => {
    const health = checkTypeSafeStorageHealth()
    
    if (health.usagePercent > 85) {
      console.warn('🧹 Auto-cleanup triggered - storage usage at', `${health.usagePercent.toFixed(1)}%`)
      clearOldPersistenceData()
    }
  }

  // Check on page load
  checkAndCleanup()
  
  // Set up periodic cleanup check (every 5 minutes)
  const interval = setInterval(checkAndCleanup, 5 * 60 * 1000)
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval)
  })
}

// ============================================================================
// ENHANCED TYPE-SAFE UTILITIES
// ============================================================================

/**
 * Create type-safe persistence manager for complex state management
 */
export interface TypeSafePersistenceManager<T> {
  save: (state: T) => Promise<void>
  load: () => Promise<T | null>
  clear: () => Promise<void>
  migrate: (targetVersion: number) => Promise<void>
  getHealth: () => StorageHealthReport
}

export const createTypeSafePersistenceManager = <T>(
  sliceType: SlicePersistenceType,
  defaultState: T
): TypeSafePersistenceManager<T> => {
  const config = createSliceConfig(sliceType)
  const storage = config.storage || createTypeSafeStorage()
  
  return {
    save: async (state: T): Promise<void> => {
      try {
        const partializedState = config.partialize(state as any)
        const serialized = JSON.stringify(partializedState)
        storage.setItem(config.name, serialized)
      } catch (error) {
        throw new Error(`Failed to save state for ${sliceType}: ${error}`)
      }
    },
    
    load: async (): Promise<T | null> => {
      try {
        const serialized = storage.getItem(config.name)
        if (!serialized) return null
        
        const parsed = JSON.parse(serialized)
        return config.merge(parsed, defaultState as any) as T
      } catch (error) {
        console.warn(`Failed to load state for ${sliceType}:`, error)
        return null
      }
    },
    
    clear: async (): Promise<void> => {
      try {
        storage.removeItem(config.name)
      } catch (error) {
        throw new Error(`Failed to clear state for ${sliceType}: ${error}`)
      }
    },
    
    migrate: async (_targetVersion: number): Promise<void> => {
      if (!config.migrate) {
        throw new Error(`No migration function available for ${sliceType}`)
      }
      
      try {
        const currentData = await this.load()
        if (currentData) {
          const migrated = config.migrate(currentData, config.version)
          await this.save(migrated as T)
        }
      } catch (error) {
        throw new Error(`Migration failed for ${sliceType}: ${error}`)
      }
    },
    
    getHealth: (): StorageHealthReport => {
      return checkTypeSafeStorageHealth()
    }
  }
}

// Export the main middleware creator with proper typing
export default createTypeSafePersistenceMiddleware

// Re-export the legacy function name for backward compatibility
export const createPersistenceMiddleware = createTypeSafePersistenceMiddleware