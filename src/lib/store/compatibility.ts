/**
 * Backward Compatibility Layer
 * 
 * This module provides compatibility with the existing store interface
 * while gradually migrating to the new slice-based architecture.
 * 
 * Components can continue using the old interface while we migrate
 * them to use the new optimized hooks.
 */

import { useScratchPadStore } from './index'
import type { Note, View, LayoutMode } from '../../types'

// Legacy interface that matches the original store
interface LegacyScratchPadState {
  // Core state
  notes: Note[]
  activeNoteId: number | null
  currentView: View
  isCommandPaletteOpen: boolean
  isLoading: boolean
  error: string | null

  // UI state
  expandedFolders: Set<string>
  selectedSearchIndex: number
  searchQuery: string

  // Performance state
  notesCount: number
  hasMoreNotes: boolean
  isLoadingMore: boolean

  // Legacy actions (mapped to new slice actions)
  setCurrentView: (view: View) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveNote: (noteId: number) => void
  setError: (error: string | null) => void

  // Note management
  loadNotes: () => Promise<void>
  loadMoreNotes: () => Promise<void>
  saveNote: (content: string) => Promise<void>
  saveNoteDebounced: (content: string) => void
  createNote: (content?: string) => Promise<void>
  deleteNote: (noteId: number) => Promise<void>
  updateNote: (note: Note) => Promise<void>

  // Search
  setSearchQuery: (query: string) => void
  searchNotes: (query: string) => Promise<Note[]>
  setSelectedSearchIndex: (index: number) => void

  // UI helpers
  toggleFolder: (folderId: string) => void
  getActiveNote: () => Note | undefined

  // Global shortcut management
  getCurrentGlobalShortcut: () => Promise<string | null>
  registerGlobalShortcut: (shortcut: string) => Promise<void>
  unregisterGlobalShortcut: (shortcut: string) => Promise<void>
  updateGlobalShortcut: (oldShortcut: string, newShortcut: string) => Promise<void>
  testGlobalShortcut: (shortcut: string) => Promise<boolean>
  getSuggestedGlobalShortcuts: () => Promise<string[]>
  isGlobalShortcutRegistered: (shortcut: string) => Promise<boolean>

  // Window management
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  setLayoutMode: (mode: LayoutMode) => Promise<void>
  getLayoutMode: () => Promise<LayoutMode>
  centerWindow: () => Promise<void>
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  isWindowVisible: () => Promise<boolean>
  isWindowFocused: () => Promise<boolean>

  // Settings management
  getAllSettings: () => Promise<Record<string, string>>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (jsonContent: string) => Promise<number>
  resetSettingsToDefaults: () => Promise<void>
  initializeSettings: () => Promise<void>

  // Plugin management
  getPluginInfo: () => Promise<Array<Record<string, string>>>
  getPluginCount: () => Promise<number>
  getAvailableNoteFormats: () => Promise<string[]>
  reloadPlugins: () => Promise<string>
}

/**
 * Compatibility hook that maps new slice-based store to legacy interface
 * @deprecated Use specific slice hooks for better performance
 */
export const useLegacyScratchPadStore = (): LegacyScratchPadState => {
  const store = useScratchPadStore()
  
  // Warn about legacy usage in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ useLegacyScratchPadStore is deprecated. ' +
      'Consider migrating to specific hooks like useNotes(), useUI(), etc. for better performance.'
    )
  }

  // Map new store structure to legacy interface
  return {
    // Core state mapping
    notes: store.getNotesWithOptimisticUpdates(),
    activeNoteId: store.activeNoteId,
    currentView: store.currentView,
    isCommandPaletteOpen: store.isCommandPaletteOpen,
    isLoading: store.isLoading || store.hasAnyLoading(),
    error: store.error,

    // UI state mapping
    expandedFolders: store.expandedFolders,
    selectedSearchIndex: store.selectedSearchIndex,
    searchQuery: store.searchQuery,

    // Performance state mapping
    notesCount: store.notesCount,
    hasMoreNotes: store.hasMoreNotes,
    isLoadingMore: store.isLoadingMore,

    // Action mappings - these remain the same
    setCurrentView: store.setCurrentView,
    setCommandPaletteOpen: store.setCommandPaletteOpen,
    setActiveNote: store.setActiveNote,
    setError: store.setError,

    // Note management mappings
    loadNotes: store.loadNotes,
    loadMoreNotes: store.loadMoreNotes,
    saveNote: store.saveNote,
    saveNoteDebounced: store.saveNoteDebounced,
    createNote: store.createNote,
    deleteNote: store.deleteNote,
    updateNote: store.updateNote,

    // Search mappings
    setSearchQuery: store.setSearchQuery,
    searchNotes: store.searchNotes,
    setSelectedSearchIndex: store.setSelectedSearchIndex,

    // UI helper mappings
    toggleFolder: store.toggleFolder,
    getActiveNote: store.getActiveNote,

    // Global shortcut mappings
    getCurrentGlobalShortcut: async () => {
      await store.getCurrentGlobalShortcut()
      return store.currentGlobalShortcut
    },
    registerGlobalShortcut: store.registerGlobalShortcut,
    unregisterGlobalShortcut: store.unregisterGlobalShortcut,
    updateGlobalShortcut: store.updateGlobalShortcut,
    testGlobalShortcut: store.testGlobalShortcut,
    getSuggestedGlobalShortcuts: async () => {
      await store.getSuggestedGlobalShortcuts()
      return store.globalShortcutSuggestions
    },
    isGlobalShortcutRegistered: store.checkGlobalShortcutRegistration,

    // Window management mappings
    showWindow: store.showWindow,
    hideWindow: store.hideWindow,
    toggleWindow: store.toggleWindow,
    setLayoutMode: store.setLayoutMode,
    getLayoutMode: async () => {
      await store.getLayoutMode()
      return store.layoutMode
    },
    centerWindow: store.centerWindow,
    setAlwaysOnTop: store.setAlwaysOnTop,
    isWindowVisible: async () => {
      await store.checkWindowVisibility()
      return store.isWindowVisible
    },
    isWindowFocused: async () => {
      await store.checkWindowFocus()
      return store.isWindowFocused
    },

    // Settings management mappings
    getAllSettings: async () => {
      await store.loadSettings()
      const settings = store.settings
      // Convert typed settings back to string record for compatibility
      const stringSettings: Record<string, string> = {}
      Object.entries(settings).forEach(([key, value]) => {
        stringSettings[key] = String(value)
      })
      return stringSettings
    },
    getSetting: (key: string) => store.getSetting(key as any),
    setSetting: (key: string, value: string) => store.setSetting(key as any, value),
    exportSettings: store.exportSettings,
    importSettings: store.importSettings,
    resetSettingsToDefaults: store.resetSettingsToDefaults,
    initializeSettings: store.initializeSettings,

    // Plugin management mappings
    getPluginInfo: async () => {
      await store.loadPluginInfo()
      return store.pluginInfo
    },
    getPluginCount: async () => {
      await store.getPluginCount()
      return store.pluginCount
    },
    getAvailableNoteFormats: async () => {
      await store.getAvailableNoteFormats()
      return store.availableNoteFormats
    },
    reloadPlugins: store.reloadPlugins
  }
}

/**
 * Migration utility to help identify which components are using legacy store
 * Run in development to see which components need migration
 */
export const auditLegacyUsage = () => {
  if (process.env.NODE_ENV !== 'development') return

  const originalHook = useLegacyScratchPadStore
  let usageCount = 0
  const usageLocations: string[] = []

  // @ts-ignore - Override for development tracking
  window.useLegacyScratchPadStore = function(...args: any[]) {
    usageCount++
    
    // Try to get component name from stack trace
    try {
      const stack = new Error().stack
      if (stack) {
        const lines = stack.split('\n')
        const componentLine = lines.find(line => 
          line.includes('.tsx') || line.includes('.jsx')
        )
        if (componentLine) {
          const match = componentLine.match(/([^/\\]+\.(tsx|jsx))/)
          if (match) {
            usageLocations.push(match[1])
          }
        }
      }
    } catch (error) {
      // Ignore stack trace errors
    }
    
    return originalHook.apply(this, args as [])
  }

  // Report usage after a delay
  setTimeout(() => {
    if (usageCount > 0) {
      console.group('📊 Legacy Store Usage Audit')
      console.log(`Total legacy hook calls: ${usageCount}`)
      console.log('Components using legacy store:', [...new Set(usageLocations)])
      console.log('Consider migrating these components to use specific hooks for better performance.')
      console.groupEnd()
    }
  }, 5000)
}

/**
 * Migration helper that provides both old and new interfaces
 * Useful during gradual migration
 */
export const useBridgedStore = () => {
  const newStore = useScratchPadStore()
  const legacyStore = useLegacyScratchPadStore()
  
  return {
    // New optimized interface
    new: newStore,
    // Legacy interface for backward compatibility
    legacy: legacyStore,
    // Migration helpers
    migrate: {
      notes: () => newStore.notes,
      activeNote: () => newStore.getActiveNote(),
      ui: () => ({
        currentView: newStore.currentView,
        isCommandPaletteOpen: newStore.isCommandPaletteOpen,
        isLoading: newStore.hasAnyLoading(),
        error: newStore.error
      }),
      search: () => ({
        query: newStore.searchQuery,
        results: newStore.searchResults,
        isSearching: newStore.isSearching
      })
    }
  }
}

/**
 * Performance comparison utility
 * Helps measure performance improvement after migration
 */
export const measurePerformanceImprovement = () => {
  if (process.env.NODE_ENV !== 'development') return

  const metrics = {
    legacyRenderCount: 0,
    optimizedRenderCount: 0,
    legacyRenderTime: 0,
    optimizedRenderTime: 0
  }

  return {
    trackLegacyRender: (renderTime: number) => {
      metrics.legacyRenderCount++
      metrics.legacyRenderTime += renderTime
    },
    trackOptimizedRender: (renderTime: number) => {
      metrics.optimizedRenderCount++
      metrics.optimizedRenderTime += renderTime
    },
    getMetrics: () => ({
      ...metrics,
      averageLegacyRenderTime: metrics.legacyRenderTime / metrics.legacyRenderCount || 0,
      averageOptimizedRenderTime: metrics.optimizedRenderTime / metrics.optimizedRenderCount || 0,
      improvement: ((metrics.legacyRenderTime - metrics.optimizedRenderTime) / metrics.legacyRenderTime) * 100 || 0
    })
  }
}

// Auto-run audit in development
if (process.env.NODE_ENV === 'development') {
  auditLegacyUsage()
}

export default useLegacyScratchPadStore