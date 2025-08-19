import { StateCreator } from "zustand"
import type { View } from "../../../types"

export interface UISlice {
  // View state
  currentView: View
  isCommandPaletteOpen: boolean
  
  // Loading states
  isLoading: boolean
  loadingOperations: Set<string>
  
  // UI state
  expandedFolders: Set<string>
  sidebarWidth: number
  isFullscreen: boolean
  
  // Error state
  error: string | null
  errorTimestamp: number | null
  
  // Focus management
  focusedElement: string | null
  
  // Actions
  setCurrentView: (view: View) => void
  setCommandPaletteOpen: (open: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setLoading: (loading: boolean) => void
  addLoadingOperation: (operation: string) => void
  removeLoadingOperation: (operation: string) => void
  toggleFolder: (folderId: string) => void
  setSidebarWidth: (width: number) => void
  setFullscreen: (fullscreen: boolean) => void
  setFocusedElement: (element: string | null) => void
  
  // Selectors
  isOperationLoading: (operation: string) => boolean
  hasAnyLoading: () => boolean
  isErrorRecent: (maxAge?: number) => boolean
}

const DEFAULT_SIDEBAR_WIDTH = 280
const ERROR_DISPLAY_DURATION = 5000 // 5 seconds

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  currentView: "note",
  isCommandPaletteOpen: false,
  isLoading: false,
  loadingOperations: new Set(),
  expandedFolders: new Set(["recent", "all-notes"]),
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  isFullscreen: false,
  error: null,
  errorTimestamp: null,
  focusedElement: null,

  // Actions
  setCurrentView: (view) => set({ currentView: view }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  setError: (error) => set({ 
    error, 
    errorTimestamp: error ? Date.now() : null 
  }),

  clearError: () => set({ 
    error: null, 
    errorTimestamp: null 
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  addLoadingOperation: (operation) => {
    set(state => {
      const newOperations = new Set(state.loadingOperations)
      newOperations.add(operation)
      return { 
        loadingOperations: newOperations,
        isLoading: newOperations.size > 0
      }
    })
  },

  removeLoadingOperation: (operation) => {
    set(state => {
      const newOperations = new Set(state.loadingOperations)
      newOperations.delete(operation)
      return { 
        loadingOperations: newOperations,
        isLoading: newOperations.size > 0
      }
    })
  },

  toggleFolder: (folderId) => {
    set(state => {
      const newExpanded = new Set(state.expandedFolders)
      if (newExpanded.has(folderId)) {
        newExpanded.delete(folderId)
      } else {
        newExpanded.add(folderId)
      }
      return { expandedFolders: newExpanded }
    })
  },

  setSidebarWidth: (width) => {
    // Constrain width to reasonable bounds
    const constrainedWidth = Math.max(200, Math.min(600, width))
    set({ sidebarWidth: constrainedWidth })
  },

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

  setFocusedElement: (element) => set({ focusedElement: element }),

  // Selectors
  isOperationLoading: (operation) => {
    const { loadingOperations } = get()
    return loadingOperations.has(operation)
  },

  hasAnyLoading: () => {
    const { loadingOperations } = get()
    return loadingOperations.size > 0
  },

  isErrorRecent: (maxAge = ERROR_DISPLAY_DURATION) => {
    const { error, errorTimestamp } = get()
    if (!error || !errorTimestamp) return false
    
    return (Date.now() - errorTimestamp) < maxAge
  }
})