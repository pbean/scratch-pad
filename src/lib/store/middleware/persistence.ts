import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Define what parts of state should be persisted
interface PersistConfig<T> {
  name: string
  storage?: any
  partialize?: (state: T) => Partial<T>
  onRehydrateStorage?: (state: T) => ((state: T, error?: Error) => void) | void
  version?: number
  migrate?: (persistedState: any, version: number) => T
  merge?: (persistedState: unknown, currentState: T) => T
}

// Configuration for selective persistence
const UI_PERSISTENCE_CONFIG = {
  name: 'scratch-pad-ui',
  partialize: (state: any) => ({
    currentView: state.currentView,
    expandedFolders: Array.from(state.expandedFolders), // Convert Set to Array for JSON
    sidebarWidth: state.sidebarWidth,
    isFullscreen: state.isFullscreen
  }),
  merge: (persistedState: any, currentState: any) => ({
    ...currentState,
    ...persistedState,
    expandedFolders: new Set(persistedState?.expandedFolders || []) // Convert back to Set
  }),
  version: 1
}

const SEARCH_PERSISTENCE_CONFIG = {
  name: 'scratch-pad-search',
  partialize: (state: any) => ({
    recentSearches: state.recentSearches,
    searchHistory: state.searchHistory?.slice(0, 10) || [] // Only persist last 10 searches
  }),
  version: 1
}

const NOTES_PERSISTENCE_CONFIG = {
  name: 'scratch-pad-notes',
  partialize: (state: any) => ({
    activeNoteId: state.activeNoteId
    // Note: We don't persist notes themselves as they come from the database
  }),
  version: 1
}

// Custom storage adapter for better error handling
const createSafeStorage = () => {
  const storage = {
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
  
  return storage
}

// Clean up old persistence data to free up space
const clearOldPersistenceData = () => {
  try {
    const keys = Object.keys(localStorage)
    const scratchPadKeys = keys.filter(key => key.startsWith('scratch-pad-'))
    
    // Keep only the most recent data
    scratchPadKeys.forEach(key => {
      if (key.includes('search') || key.includes('performance')) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.warn('Failed to clear old persistence data', error)
  }
}

// Enhanced persistence middleware with selective storage
type PersistenceMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, [...Mcs, ['zustand/persist', unknown]]>

// Create selective persistence based on slice type
export const createPersistenceMiddleware = <T>(
  sliceType: 'ui' | 'search' | 'notes' | 'settings' | 'system'
): PersistenceMiddleware => {
  const configs = {
    ui: UI_PERSISTENCE_CONFIG,
    search: SEARCH_PERSISTENCE_CONFIG,
    notes: NOTES_PERSISTENCE_CONFIG,
    settings: {
      name: 'scratch-pad-settings',
      partialize: (state: any) => ({
        // Settings are persisted via the backend, but we can cache some UI-related settings
        isDirty: false // Reset dirty flag on load
      }),
      version: 1
    },
    system: {
      name: 'scratch-pad-system',
      partialize: (state: any) => ({
        layoutMode: state.layoutMode,
        isAlwaysOnTop: state.isAlwaysOnTop
        // Don't persist connection status or errors
      }),
      version: 1
    }
  }
  
  const config = configs[sliceType]
  
  return persist as any // Type assertion needed for complex Zustand types
}

// Utility to manually clear all persistence data
export const clearAllPersistence = () => {
  const persistenceKeys = [
    'scratch-pad-ui',
    'scratch-pad-search', 
    'scratch-pad-notes',
    'scratch-pad-settings',
    'scratch-pad-system'
  ]
  
  persistenceKeys.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`Failed to clear persistence for ${key}`, error)
    }
  })
}

// Migration helpers for version updates
export const createMigration = (migrations: Record<number, (state: any) => any>) => {
  return (persistedState: any, version: number) => {
    let migratedState = persistedState
    
    // Apply migrations in order
    for (let v = version; v < Object.keys(migrations).length; v++) {
      if (migrations[v + 1]) {
        migratedState = migrations[v + 1](migratedState)
      }
    }
    
    return migratedState
  }
}

// Storage health check
export const checkStorageHealth = (): { healthy: boolean; available: number; used: number } => {
  try {
    const testKey = 'storage-test'
    const testValue = 'test'
    
    localStorage.setItem(testKey, testValue)
    const retrieved = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)
    
    const healthy = retrieved === testValue
    
    // Rough storage usage calculation
    let used = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length
      }
    }
    
    // Most browsers limit localStorage to ~5-10MB
    const available = 10 * 1024 * 1024 // Assume 10MB limit
    
    return { healthy, available, used }
  } catch (error) {
    return { healthy: false, available: 0, used: 0 }
  }
}

// Development helper to inspect persisted data
export const inspectPersistedData = () => {
  if (process.env.NODE_ENV !== 'development') return
  
  console.group('🗄️ Persisted Store Data')
  
  const persistenceKeys = [
    'scratch-pad-ui',
    'scratch-pad-search',
    'scratch-pad-notes', 
    'scratch-pad-settings',
    'scratch-pad-system'
  ]
  
  persistenceKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key)
      if (data) {
        const parsed = JSON.parse(data)
        console.log(`${key}:`, parsed)
      } else {
        console.log(`${key}: No data`)
      }
    } catch (error) {
      console.warn(`${key}: Parse error`, error)
    }
  })
  
  const health = checkStorageHealth()
  console.log('Storage Health:', health)
  
  console.groupEnd()
}

export default createPersistenceMiddleware