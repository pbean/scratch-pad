import { useCallback, useMemo, useEffect } from 'react'
import {
  useScratchPadStore,
  useNotesSlice,
  useSearchSlice, 
  useUISlice,
  useSettingsSlice,
  useSystemSlice
} from './index'
import type { Note, Settings } from '../../types'
import { getDefaultSettingValue } from './slices/settingsSlice'

// Store type imports for proper typing
type ScratchPadStore = ReturnType<typeof useScratchPadStore.getState>
type StoreSelector<T, R> = (state: T) => R
type ScratchPadStoreSelector<R> = StoreSelector<ScratchPadStore, R>

// Performance-optimized hooks with selective subscriptions

/**
 * Hook for components that only need specific notes data
 * Prevents re-renders when unrelated state changes
 */
export const useNotes = () => {
  return useNotesSlice()
}

/**
 * Hook for active note management with optimistic updates
 * Includes the active note with any pending optimistic changes
 */
export const useActiveNote = () => {
  return useScratchPadStore(
    (state) => ({
      activeNote: state.getActiveNote(),
      activeNoteId: state.activeNoteId,
      setActiveNote: state.setActiveNote,
      saveNoteDebounced: state.saveNoteDebounced,
      updateNoteOptimistic: state.updateNoteOptimistic
    })
  )
}

/**
 * Hook for note list components with virtualization support
 * Includes optimistic updates for smooth UI
 */
export const useNotesList = () => {
  return useScratchPadStore(
    (state) => ({
      notes: state.getNotesWithOptimisticUpdates(),
      notesCount: state.notesCount,
      hasMoreNotes: state.hasMoreNotes,
      isLoadingNotes: state.isLoadingNotes,
      isLoadingMore: state.isLoadingMore,
      loadNotes: state.loadNotes,
      loadMoreNotes: state.loadMoreNotes,
      activeNoteId: state.activeNoteId
    })
  )
}

/**
 * Hook for search functionality with caching
 * Optimized for search components
 */
export const useSearch = () => {
  const searchSlice = useSearchSlice()
  
  // Memoized search suggestions
  const getSearchSuggestions = useCallback((input: string) => {
    return searchSlice.getRecentSearchSuggestions(input)
  }, [searchSlice.getRecentSearchSuggestions])
  
  return {
    ...searchSlice,
    getSearchSuggestions
  }
}

/**
 * Hook for UI state with minimal re-renders
 * Groups related UI state together
 */
export const useUI = () => {
  return useUISlice()
}

/**
 * Hook for current view management
 * Isolated to prevent unnecessary re-renders in other components
 */
export const useCurrentView = () => {
  return useScratchPadStore(
    (state) => ({
      currentView: state.currentView,
      setCurrentView: state.setCurrentView
    })
  )
}

/**
 * Hook for loading states across the app
 * Aggregates loading information from all slices
 */
export const useLoadingState = () => {
  return useScratchPadStore(
    (state) => ({
      isLoading: state.hasAnyLoading(),
      isLoadingNotes: state.isLoadingNotes,
      isLoadingMore: state.isLoadingMore,
      isLoadingSettings: state.isLoadingSettings,
      isSearching: state.isSearching,
      loadingOperations: state.loadingOperations,
      connectionStatus: state.connectionStatus
    })
  )
}

/**
 * Hook for error handling across the app
 * Provides centralized error management
 */
export const useErrorState = () => {
  return useScratchPadStore(
    (state) => ({
      error: state.error,
      errorTimestamp: state.errorTimestamp,
      isErrorRecent: state.isErrorRecent,
      systemErrors: state.getRecentSystemErrors(),
      setError: state.setError,
      clearError: state.clearError,
      clearSystemErrors: state.clearSystemErrors
    })
  )
}

/**
 * Hook for settings management
 * Includes dirty state tracking for unsaved changes
 */
export const useSettings = () => {
  const settingsSlice = useSettingsSlice()
  
  // Memoized setting getter with type safety
  const getSettingValue = useCallback(
    <K extends keyof Settings>(key: K): Settings[K] | undefined => {
      return settingsSlice.getSettingValue(key)
    },
    [settingsSlice.getSettingValue]
  )
  
  return {
    ...settingsSlice,
    getSettingValue
  }
}

/**
 * Hook for system health and performance monitoring
 * Provides system status information
 */
export const useSystem = () => {
  const systemSlice = useSystemSlice()
  
  // Memoized performance stats
  const performanceStats = useMemo(() => {
    return systemSlice.getAveragePerformance()
  }, [systemSlice.performanceMetrics])
  
  return {
    ...systemSlice,
    performanceStats,
    isHealthy: systemSlice.isSystemHealthy()
  }
}

/**
 * Hook for command palette functionality
 * Includes all relevant actions and state
 */
export const useCommandPalette = () => {
  return useScratchPadStore(
    (state) => ({
      isOpen: state.isCommandPaletteOpen,
      setOpen: state.setCommandPaletteOpen,
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      // Quick actions
      createNote: state.createNote,
      searchNotes: state.searchNotes,
      performSearch: state.performSearch,
      clearSearch: state.clearSearch,
      // System actions
      showWindow: state.showWindow,
      hideWindow: state.hideWindow,
      toggleWindow: state.toggleWindow,
      centerWindow: state.centerWindow
    })
  )
}

/**
 * Hook for folder/sidebar management
 * Handles expandable folders and sidebar state
 */
export const useFolders = () => {
  return useScratchPadStore(
    (state) => ({
      expandedFolders: state.expandedFolders,
      toggleFolder: state.toggleFolder,
      sidebarWidth: state.sidebarWidth,
      setSidebarWidth: state.setSidebarWidth
    })
  )
}

/**
 * Hook for global shortcuts management
 * Isolated functionality for shortcuts
 */
export const useGlobalShortcuts = () => {
  return useScratchPadStore(
    (state) => ({
      currentGlobalShortcut: state.currentGlobalShortcut,
      suggestions: state.globalShortcutSuggestions,
      isRegistered: state.isGlobalShortcutRegistered,
      registerShortcut: state.registerGlobalShortcut,
      unregisterShortcut: state.unregisterGlobalShortcut,
      updateShortcut: state.updateGlobalShortcut,
      testShortcut: state.testGlobalShortcut,
      getSuggestions: state.getSuggestedGlobalShortcuts,
      checkRegistration: state.checkGlobalShortcutRegistration
    })
  )
}

/**
 * Hook for window management
 * Controls window visibility, layout, and positioning
 */
export const useWindow = () => {
  return useScratchPadStore(
    (state) => ({
      isVisible: state.isWindowVisible,
      isFocused: state.isWindowFocused,
      layoutMode: state.layoutMode,
      isAlwaysOnTop: state.isAlwaysOnTop,
      showWindow: state.showWindow,
      hideWindow: state.hideWindow,
      toggleWindow: state.toggleWindow,
      setLayoutMode: state.setLayoutMode,
      centerWindow: state.centerWindow,
      setAlwaysOnTop: state.setAlwaysOnTop,
      checkVisibility: state.checkWindowVisibility,
      checkFocus: state.checkWindowFocus
    })
  )
}

/**
 * Hook for plugin management
 * Provides plugin information and controls
 */
export const usePlugins = () => {
  return useScratchPadStore(
    (state) => ({
      pluginInfo: state.pluginInfo,
      pluginCount: state.pluginCount,
      availableFormats: state.availableNoteFormats,
      loadPluginInfo: state.loadPluginInfo,
      getPluginCount: state.getPluginCount,
      getAvailableFormats: state.getAvailableNoteFormats,
      reloadPlugins: state.reloadPlugins
    })
  )
}

/**
 * Performance monitoring hook for components
 * Tracks component render performance
 */
export const usePerformanceMonitoring = (componentName: string) => {
  const { trackRender } = useSystem()
  
  useEffect(() => {
    let renderStart = performance.now()
    
    const trackComponentRender = () => {
      const renderTime = performance.now() - renderStart
      trackRender(renderTime)
      
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }
      
      renderStart = performance.now()
    }
    
    // Track initial render
    trackComponentRender()
    
    return () => {
      // Track final render on unmount
      trackComponentRender()
    }
  })
}

/**
 * Backward compatibility hook - maps to new store structure
 * @deprecated Use specific hooks instead for better performance
 */
export const useLegacyStore = () => {
  console.warn('useLegacyStore is deprecated. Use specific hooks for better performance.')
  return useScratchPadStore()
}

// ============================================================================
// TYPE-SAFE SELECTOR UTILITIES - Phase 1 Implementation
// ============================================================================

/**
 * Type-safe note selector factory with proper return typing
 * Replaces previous any usage with strict typing
 */
export function createNoteSelector(noteId: number): ScratchPadStoreSelector<{
  note: Note | undefined
  isActive: boolean
  hasOptimisticUpdates: boolean
}> {
  return (state: ScratchPadStore) => ({
    note: state.getNoteById(noteId),
    isActive: state.activeNoteId === noteId,
    hasOptimisticUpdates: state.optimisticUpdates.has(noteId)
  })
}

/**
 * Type-safe search result selector factory with proper return typing
 * Replaces previous any usage with strict typing
 */
export function createSearchResultSelector(index: number): ScratchPadStoreSelector<{
  result: Note | undefined
  isSelected: boolean
  totalResults: number
  hasResults: boolean
}> {
  return (state: ScratchPadStore) => ({
    result: state.searchResults[index],
    isSelected: state.selectedSearchIndex === index,
    totalResults: state.searchResults.length,
    hasResults: state.searchResults.length > 0
  })
}

/**
 * Type-safe settings value selector with proper generic typing
 * Provides type-safe access to specific setting values
 */
export function createSettingSelector<K extends keyof Settings>(
  key: K
): ScratchPadStoreSelector<{
  value: Settings[K] | undefined
  hasValue: boolean
  isDefault: boolean
}> {
  return (state: ScratchPadStore) => {
    const value = state.getSettingValue(key)
    return {
      value,
      hasValue: value !== undefined,
      isDefault: value === getDefaultSettingValue(key)
    }
  }
}

/**
 * Type-safe performance metrics selector
 * Provides focused access to performance data
 */
export function createPerformanceSelector(): ScratchPadStoreSelector<{
  averageRenderTime: number
  renderCount: number
  isHealthy: boolean
  lastUpdate: number
}> {
  return (state: ScratchPadStore) => {
    const metrics = state.getAveragePerformance()
    return {
      averageRenderTime: metrics.avgRenderTime || 0,
      renderCount: metrics.renderCount || 0,
      isHealthy: state.isSystemHealthy(),
      lastUpdate: Date.now()
    }
  }
}

/**
 * Type-safe loading state selector for specific operations
 * Provides granular loading state access
 */
export function createLoadingSelector(
  operations: Array<'notes' | 'search' | 'settings' | 'more'>
): ScratchPadStoreSelector<{
  isLoading: boolean
  activeOperations: string[]
  hasAnyLoading: boolean
}> {
  return (state: ScratchPadStore) => {
    const loadingStates = {
      notes: state.isLoadingNotes,
      search: state.isSearching,
      settings: state.isLoadingSettings,
      more: state.isLoadingMore
    }
    
    const activeOperations = operations.filter(op => loadingStates[op])
    
    return {
      isLoading: activeOperations.length > 0,
      activeOperations,
      hasAnyLoading: state.hasAnyLoading()
    }
  }
}

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Make hooks available for debugging
  (window as any).__SCRATCH_PAD_HOOKS__ = {
    useNotes,
    useActiveNote,
    useNotesList,
    useSearch,
    useUI,
    useCurrentView,
    useLoadingState,
    useErrorState,
    useSettings,
    useSystem,
    useCommandPalette,
    useFolders,
    useGlobalShortcuts,
    useWindow,
    usePlugins,
    // Type-safe selectors
    createNoteSelector,
    createSearchResultSelector,
    createSettingSelector,
    createPerformanceSelector,
    createLoadingSelector
  }
}