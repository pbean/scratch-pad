import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

// Import slices
import { NotesSlice, createNotesSlice } from "./slices/notesSlice"
import { SearchSlice, createSearchSlice } from "./slices/searchSlice"
import { UISlice, createUISlice } from "./slices/uiSlice"
import { SettingsSlice, createSettingsSlice } from "./slices/settingsSlice"
import { SystemSlice, createSystemSlice } from "./slices/systemSlice"

// Import middleware
import performanceMiddleware from "./middleware/performance"
import createEnhancedDevtools from "./middleware/devtools"

// Combined store interface
export interface ScratchPadStore extends 
  NotesSlice,
  SearchSlice, 
  UISlice,
  SettingsSlice,
  SystemSlice {
  // Global actions that might affect multiple slices
  initialize: () => Promise<void>
  reset: () => void
  
  // Selective subscriptions
  subscribeToNotes: (callback: (notes: NotesSlice) => void) => () => void
  subscribeToUI: (callback: (ui: UISlice) => void) => () => void
  subscribeToSearch: (callback: (search: SearchSlice) => void) => () => void
  subscribeToSettings: (callback: (settings: SettingsSlice) => void) => () => void
  subscribeToSystem: (callback: (system: SystemSlice) => void) => () => void
}

// Create the combined store
export const useScratchPadStore = create<ScratchPadStore>()(
  // Apply middleware in correct order
  subscribeWithSelector(
    performanceMiddleware(
      createEnhancedDevtools("CombinedStore")(
        (set, get, api) => {
          // Create individual slice states
          const notesSlice = createNotesSlice(set, get, api)
          const searchSlice = createSearchSlice(set, get, api)  
          const uiSlice = createUISlice(set, get, api)
          const settingsSlice = createSettingsSlice(set, get, api)
          const systemSlice = createSystemSlice(set, get, api)
          
          return {
            // Combine all slice states and actions
            ...notesSlice,
            ...searchSlice,
            ...uiSlice,
            ...settingsSlice,
            ...systemSlice,
            
            // Global actions
            initialize: async () => {
              const { addLoadingOperation, removeLoadingOperation, setError } = get()
              
              try {
                addLoadingOperation('initialize')
                
                // Initialize in parallel where possible
                await Promise.all([
                  // Load core data
                  get().loadNotes().catch(error => {
                    console.warn('Failed to load notes during initialization:', error)
                  }),
                  
                  // Load settings
                  get().loadSettings().catch(error => {
                    console.warn('Failed to load settings during initialization:', error)
                  }),
                  
                  // Check system health
                  get().performHealthCheck().catch(error => {
                    console.warn('Failed to perform health check during initialization:', error)
                  })
                ])
                
                // Load secondary data
                await Promise.all([
                  get().getCurrentGlobalShortcut().catch(() => {}),
                  get().getLayoutMode().catch(() => {}),
                  get().loadPluginInfo().catch(() => {})
                ])
                
              } catch (error) {
                console.error('Store initialization failed:', error)
                setError(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
              } finally {
                removeLoadingOperation('initialize')
              }
            },
            
            reset: () => {
              // Reset all slices to initial state
              set({
                // Notes slice reset
                notes: [],
                activeNoteId: null,
                notesCount: 0,
                hasMoreNotes: false,
                isLoadingNotes: false,
                isLoadingMore: false,
                optimisticUpdates: new Map(),
                
                // Search slice reset
                searchQuery: "",
                searchResults: [],
                isSearching: false,
                selectedSearchIndex: 0,
                searchCache: new Map(),
                recentSearches: [],
                searchHistory: [],
                
                // UI slice reset
                currentView: "note",
                isCommandPaletteOpen: false,
                isLoading: false,
                loadingOperations: new Set(),
                expandedFolders: new Set(["recent", "all-notes"]),
                sidebarWidth: 280,
                isFullscreen: false,
                error: null,
                errorTimestamp: null,
                focusedElement: null,
                
                // Settings slice reset
                settings: {},
                isSettingsLoaded: false,
                isLoadingSettings: false,
                isDirty: false,
                lastSavedTimestamp: null,
                
                // System slice reset
                currentGlobalShortcut: null,
                globalShortcutSuggestions: [],
                isGlobalShortcutRegistered: false,
                isWindowVisible: true,
                isWindowFocused: true,
                layoutMode: "default",
                isAlwaysOnTop: false,
                lastHealthCheck: null,
                connectionStatus: 'connected',
                systemErrors: [],
                performanceMetrics: {
                  renderCount: 0,
                  lastRenderTime: 0,
                  averageRenderTime: 0
                },
                pluginInfo: [],
                pluginCount: 0,
                availableNoteFormats: ["plaintext", "markdown"]
              })
            },
            
            // Selective subscription helpers
            subscribeToNotes: (callback) => {
              return api.subscribe(
                (state) => ({
                  notes: state.notes,
                  activeNoteId: state.activeNoteId,
                  notesCount: state.notesCount,
                  hasMoreNotes: state.hasMoreNotes,
                  isLoadingNotes: state.isLoadingNotes,
                  isLoadingMore: state.isLoadingMore,
                  optimisticUpdates: state.optimisticUpdates,
                  // Include relevant actions
                  setActiveNote: state.setActiveNote,
                  loadNotes: state.loadNotes,
                  loadMoreNotes: state.loadMoreNotes,
                  createNote: state.createNote,
                  updateNote: state.updateNote,
                  updateNoteOptimistic: state.updateNoteOptimistic,
                  deleteNote: state.deleteNote,
                  saveNote: state.saveNote,
                  saveNoteDebounced: state.saveNoteDebounced,
                  getActiveNote: state.getActiveNote,
                  getNoteById: state.getNoteById,
                  getNotesWithOptimisticUpdates: state.getNotesWithOptimisticUpdates
                }),
                callback,
                {
                  equalityFn: (a, b) => {
                    // Custom equality check for notes slice
                    return (
                      a.notes === b.notes &&
                      a.activeNoteId === b.activeNoteId &&
                      a.notesCount === b.notesCount &&
                      a.hasMoreNotes === b.hasMoreNotes &&
                      a.isLoadingNotes === b.isLoadingNotes &&
                      a.isLoadingMore === b.isLoadingMore &&
                      a.optimisticUpdates === b.optimisticUpdates
                    )
                  }
                }
              )
            },
            
            subscribeToUI: (callback) => {
              return api.subscribe(
                (state) => ({
                  currentView: state.currentView,
                  isCommandPaletteOpen: state.isCommandPaletteOpen,
                  isLoading: state.isLoading,
                  loadingOperations: state.loadingOperations,
                  expandedFolders: state.expandedFolders,
                  sidebarWidth: state.sidebarWidth,
                  isFullscreen: state.isFullscreen,
                  error: state.error,
                  errorTimestamp: state.errorTimestamp,
                  focusedElement: state.focusedElement,
                  // Include relevant actions
                  setCurrentView: state.setCurrentView,
                  setCommandPaletteOpen: state.setCommandPaletteOpen,
                  setError: state.setError,
                  clearError: state.clearError,
                  setLoading: state.setLoading,
                  addLoadingOperation: state.addLoadingOperation,
                  removeLoadingOperation: state.removeLoadingOperation,
                  toggleFolder: state.toggleFolder,
                  setSidebarWidth: state.setSidebarWidth,
                  setFullscreen: state.setFullscreen,
                  setFocusedElement: state.setFocusedElement,
                  isOperationLoading: state.isOperationLoading,
                  hasAnyLoading: state.hasAnyLoading,
                  isErrorRecent: state.isErrorRecent
                }),
                callback,
                {
                  equalityFn: (a, b) => {
                    // Custom equality check for UI slice
                    return (
                      a.currentView === b.currentView &&
                      a.isCommandPaletteOpen === b.isCommandPaletteOpen &&
                      a.isLoading === b.isLoading &&
                      a.loadingOperations === b.loadingOperations &&
                      a.expandedFolders === b.expandedFolders &&
                      a.sidebarWidth === b.sidebarWidth &&
                      a.isFullscreen === b.isFullscreen &&
                      a.error === b.error &&
                      a.errorTimestamp === b.errorTimestamp &&
                      a.focusedElement === b.focusedElement
                    )
                  }
                }
              )
            },
            
            subscribeToSearch: (callback) => {
              return api.subscribe(
                (state) => ({
                  searchQuery: state.searchQuery,
                  searchResults: state.searchResults,
                  isSearching: state.isSearching,
                  selectedSearchIndex: state.selectedSearchIndex,
                  searchCache: state.searchCache,
                  recentSearches: state.recentSearches,
                  searchHistory: state.searchHistory,
                  // Include relevant actions
                  setSearchQuery: state.setSearchQuery,
                  searchNotes: state.searchNotes,
                  performSearch: state.performSearch,
                  setSelectedSearchIndex: state.setSelectedSearchIndex,
                  clearSearch: state.clearSearch,
                  clearSearchCache: state.clearSearchCache,
                  addToSearchHistory: state.addToSearchHistory,
                  removeFromSearchHistory: state.removeFromSearchHistory,
                  clearSearchHistory: state.clearSearchHistory,
                  getCachedSearch: state.getCachedSearch,
                  getRecentSearchSuggestions: state.getRecentSearchSuggestions,
                  isSearchCacheValid: state.isSearchCacheValid
                }),
                callback,
                {
                  equalityFn: (a, b) => {
                    // Custom equality check for search slice  
                    return (
                      a.searchQuery === b.searchQuery &&
                      a.searchResults === b.searchResults &&
                      a.isSearching === b.isSearching &&
                      a.selectedSearchIndex === b.selectedSearchIndex &&
                      a.searchCache === b.searchCache &&
                      a.recentSearches === b.recentSearches &&
                      a.searchHistory === b.searchHistory
                    )
                  }
                }
              )
            },
            
            subscribeToSettings: (callback) => {
              return api.subscribe(
                (state) => ({
                  settings: state.settings,
                  isSettingsLoaded: state.isSettingsLoaded,
                  isLoadingSettings: state.isLoadingSettings,
                  isDirty: state.isDirty,
                  lastSavedTimestamp: state.lastSavedTimestamp,
                  // Include relevant actions
                  loadSettings: state.loadSettings,
                  getSetting: state.getSetting,
                  setSetting: state.setSetting,
                  updateSettings: state.updateSettings,
                  saveSettings: state.saveSettings,
                  exportSettings: state.exportSettings,
                  importSettings: state.importSettings,
                  resetSettingsToDefaults: state.resetSettingsToDefaults,
                  initializeSettings: state.initializeSettings,
                  markClean: state.markClean,
                  getSettingValue: state.getSettingValue,
                  hasUnsavedChanges: state.hasUnsavedChanges,
                  isSettingDefault: state.isSettingDefault
                }),
                callback,
                {
                  equalityFn: (a, b) => {
                    // Custom equality check for settings slice
                    return (
                      a.settings === b.settings &&
                      a.isSettingsLoaded === b.isSettingsLoaded &&
                      a.isLoadingSettings === b.isLoadingSettings &&
                      a.isDirty === b.isDirty &&
                      a.lastSavedTimestamp === b.lastSavedTimestamp
                    )
                  }
                }
              )
            },
            
            subscribeToSystem: (callback) => {
              return api.subscribe(
                (state) => ({
                  currentGlobalShortcut: state.currentGlobalShortcut,
                  globalShortcutSuggestions: state.globalShortcutSuggestions,
                  isGlobalShortcutRegistered: state.isGlobalShortcutRegistered,
                  isWindowVisible: state.isWindowVisible,
                  isWindowFocused: state.isWindowFocused,
                  layoutMode: state.layoutMode,
                  isAlwaysOnTop: state.isAlwaysOnTop,
                  lastHealthCheck: state.lastHealthCheck,
                  connectionStatus: state.connectionStatus,
                  systemErrors: state.systemErrors,
                  performanceMetrics: state.performanceMetrics,
                  pluginInfo: state.pluginInfo,
                  pluginCount: state.pluginCount,
                  availableNoteFormats: state.availableNoteFormats,
                  // Include relevant actions
                  getCurrentGlobalShortcut: state.getCurrentGlobalShortcut,
                  registerGlobalShortcut: state.registerGlobalShortcut,
                  unregisterGlobalShortcut: state.unregisterGlobalShortcut,
                  updateGlobalShortcut: state.updateGlobalShortcut,
                  testGlobalShortcut: state.testGlobalShortcut,
                  getSuggestedGlobalShortcuts: state.getSuggestedGlobalShortcuts,
                  checkGlobalShortcutRegistration: state.checkGlobalShortcutRegistration,
                  showWindow: state.showWindow,
                  hideWindow: state.hideWindow,
                  toggleWindow: state.toggleWindow,
                  setLayoutMode: state.setLayoutMode,
                  getLayoutMode: state.getLayoutMode,
                  centerWindow: state.centerWindow,
                  setAlwaysOnTop: state.setAlwaysOnTop,
                  checkWindowVisibility: state.checkWindowVisibility,
                  checkWindowFocus: state.checkWindowFocus,
                  performHealthCheck: state.performHealthCheck,
                  addSystemError: state.addSystemError,
                  clearSystemErrors: state.clearSystemErrors,
                  updateConnectionStatus: state.updateConnectionStatus,
                  trackRender: state.trackRender,
                  updateMemoryUsage: state.updateMemoryUsage,
                  loadPluginInfo: state.loadPluginInfo,
                  getPluginCount: state.getPluginCount,
                  getAvailableNoteFormats: state.getAvailableNoteFormats,
                  reloadPlugins: state.reloadPlugins,
                  isSystemHealthy: state.isSystemHealthy,
                  getRecentSystemErrors: state.getRecentSystemErrors,
                  getAveragePerformance: state.getAveragePerformance
                }),
                callback,
                {
                  equalityFn: (a, b) => {
                    // Custom equality check for system slice
                    return (
                      a.currentGlobalShortcut === b.currentGlobalShortcut &&
                      a.isGlobalShortcutRegistered === b.isGlobalShortcutRegistered &&
                      a.isWindowVisible === b.isWindowVisible &&
                      a.isWindowFocused === b.isWindowFocused &&
                      a.layoutMode === b.layoutMode &&
                      a.isAlwaysOnTop === b.isAlwaysOnTop &&
                      a.lastHealthCheck === b.lastHealthCheck &&
                      a.connectionStatus === b.connectionStatus &&
                      a.systemErrors === b.systemErrors &&
                      a.performanceMetrics === b.performanceMetrics &&
                      a.pluginInfo === b.pluginInfo &&
                      a.pluginCount === b.pluginCount &&
                      a.availableNoteFormats === b.availableNoteFormats
                    )
                  }
                }
              )
            }
          }
        }
      )
    )
  )
)

// Export store type for external usage
export type { ScratchPadStore }

// Export individual slice hooks for selective subscriptions
export const useNotesSlice = () => useScratchPadStore(
  (state) => ({
    notes: state.notes,
    activeNoteId: state.activeNoteId,
    notesCount: state.notesCount,
    hasMoreNotes: state.hasMoreNotes,
    isLoadingNotes: state.isLoadingNotes,
    isLoadingMore: state.isLoadingMore,
    optimisticUpdates: state.optimisticUpdates,
    setActiveNote: state.setActiveNote,
    loadNotes: state.loadNotes,
    loadMoreNotes: state.loadMoreNotes,
    createNote: state.createNote,
    updateNote: state.updateNote,
    updateNoteOptimistic: state.updateNoteOptimistic,
    deleteNote: state.deleteNote,
    saveNote: state.saveNote,
    saveNoteDebounced: state.saveNoteDebounced,
    getActiveNote: state.getActiveNote,
    getNoteById: state.getNoteById,
    getNotesWithOptimisticUpdates: state.getNotesWithOptimisticUpdates
  })
)

export const useSearchSlice = () => useScratchPadStore(
  (state) => ({
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    isSearching: state.isSearching,
    selectedSearchIndex: state.selectedSearchIndex,
    searchCache: state.searchCache,
    recentSearches: state.recentSearches,
    searchHistory: state.searchHistory,
    setSearchQuery: state.setSearchQuery,
    searchNotes: state.searchNotes,
    performSearch: state.performSearch,
    setSelectedSearchIndex: state.setSelectedSearchIndex,
    clearSearch: state.clearSearch,
    clearSearchCache: state.clearSearchCache,
    addToSearchHistory: state.addToSearchHistory,
    removeFromSearchHistory: state.removeFromSearchHistory,
    clearSearchHistory: state.clearSearchHistory,
    getCachedSearch: state.getCachedSearch,
    getRecentSearchSuggestions: state.getRecentSearchSuggestions,
    isSearchCacheValid: state.isSearchCacheValid
  })
)

export const useUISlice = () => useScratchPadStore(
  (state) => ({
    currentView: state.currentView,
    isCommandPaletteOpen: state.isCommandPaletteOpen,
    isLoading: state.isLoading,
    loadingOperations: state.loadingOperations,
    expandedFolders: state.expandedFolders,
    sidebarWidth: state.sidebarWidth,
    isFullscreen: state.isFullscreen,
    error: state.error,
    errorTimestamp: state.errorTimestamp,
    focusedElement: state.focusedElement,
    setCurrentView: state.setCurrentView,
    setCommandPaletteOpen: state.setCommandPaletteOpen,
    setError: state.setError,
    clearError: state.clearError,
    setLoading: state.setLoading,
    addLoadingOperation: state.addLoadingOperation,
    removeLoadingOperation: state.removeLoadingOperation,
    toggleFolder: state.toggleFolder,
    setSidebarWidth: state.setSidebarWidth,
    setFullscreen: state.setFullscreen,
    setFocusedElement: state.setFocusedElement,
    isOperationLoading: state.isOperationLoading,
    hasAnyLoading: state.hasAnyLoading,
    isErrorRecent: state.isErrorRecent
  })
)

export const useSettingsSlice = () => useScratchPadStore(
  (state) => ({
    settings: state.settings,
    isSettingsLoaded: state.isSettingsLoaded,
    isLoadingSettings: state.isLoadingSettings,
    isDirty: state.isDirty,
    lastSavedTimestamp: state.lastSavedTimestamp,
    loadSettings: state.loadSettings,
    getSetting: state.getSetting,
    setSetting: state.setSetting,
    updateSettings: state.updateSettings,
    saveSettings: state.saveSettings,
    exportSettings: state.exportSettings,
    importSettings: state.importSettings,
    resetSettingsToDefaults: state.resetSettingsToDefaults,
    initializeSettings: state.initializeSettings,
    markClean: state.markClean,
    getSettingValue: state.getSettingValue,
    hasUnsavedChanges: state.hasUnsavedChanges,
    isSettingDefault: state.isSettingDefault
  })
)

export const useSystemSlice = () => useScratchPadStore(
  (state) => ({
    currentGlobalShortcut: state.currentGlobalShortcut,
    globalShortcutSuggestions: state.globalShortcutSuggestions,
    isGlobalShortcutRegistered: state.isGlobalShortcutRegistered,
    isWindowVisible: state.isWindowVisible,
    isWindowFocused: state.isWindowFocused,
    layoutMode: state.layoutMode,
    isAlwaysOnTop: state.isAlwaysOnTop,
    lastHealthCheck: state.lastHealthCheck,
    connectionStatus: state.connectionStatus,
    systemErrors: state.systemErrors,
    performanceMetrics: state.performanceMetrics,
    pluginInfo: state.pluginInfo,
    pluginCount: state.pluginCount,
    availableNoteFormats: state.availableNoteFormats,
    getCurrentGlobalShortcut: state.getCurrentGlobalShortcut,
    registerGlobalShortcut: state.registerGlobalShortcut,
    unregisterGlobalShortcut: state.unregisterGlobalShortcut,
    updateGlobalShortcut: state.updateGlobalShortcut,
    testGlobalShortcut: state.testGlobalShortcut,
    getSuggestedGlobalShortcuts: state.getSuggestedGlobalShortcuts,
    checkGlobalShortcutRegistration: state.checkGlobalShortcutRegistration,
    showWindow: state.showWindow,
    hideWindow: state.hideWindow,
    toggleWindow: state.toggleWindow,
    setLayoutMode: state.setLayoutMode,
    getLayoutMode: state.getLayoutMode,
    centerWindow: state.centerWindow,
    setAlwaysOnTop: state.setAlwaysOnTop,
    checkWindowVisibility: state.checkWindowVisibility,
    checkWindowFocus: state.checkWindowFocus,
    performHealthCheck: state.performHealthCheck,
    addSystemError: state.addSystemError,
    clearSystemErrors: state.clearSystemErrors,
    updateConnectionStatus: state.updateConnectionStatus,
    trackRender: state.trackRender,
    updateMemoryUsage: state.updateMemoryUsage,
    loadPluginInfo: state.loadPluginInfo,
    getPluginCount: state.getPluginCount,
    getAvailableNoteFormats: state.getAvailableNoteFormats,
    reloadPlugins: state.reloadPlugins,
    isSystemHealthy: state.isSystemHealthy,
    getRecentSystemErrors: state.getRecentSystemErrors,
    getAveragePerformance: state.getAveragePerformance
  })
)

// Export the original store for backward compatibility during migration
export { useScratchPadStore as useScratchPadStoreNew }

// Re-export existing store temporarily
export { useScratchPadStore as default }

// Development helpers
if (process.env.NODE_ENV === 'development') {
  // Make store available globally for debugging
  (window as any).__SCRATCH_PAD_STORE__ = useScratchPadStore
  
  // Log store initialization
  console.log('🏪 ScratchPad Store initialized with slices:', {
    notes: 'NotesSlice',
    search: 'SearchSlice', 
    ui: 'UISlice',
    settings: 'SettingsSlice',
    system: 'SystemSlice'
  })
}