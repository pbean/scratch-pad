import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { LayoutMode, ApiError } from "../../../types"

export interface SystemSlice {
  // Global shortcut state
  currentGlobalShortcut: string | null
  globalShortcutSuggestions: string[]
  isGlobalShortcutRegistered: boolean
  
  // Window state
  isWindowVisible: boolean
  isWindowFocused: boolean
  layoutMode: LayoutMode
  isAlwaysOnTop: boolean
  
  // System health
  lastHealthCheck: number | null
  connectionStatus: 'connected' | 'disconnected' | 'checking'
  systemErrors: Array<{ error: string; timestamp: number; context: string }>
  performanceMetrics: {
    renderCount: number
    lastRenderTime: number
    averageRenderTime: number
    memoryUsage?: number
  }
  
  // Plugin state
  pluginInfo: Array<Record<string, string>>
  pluginCount: number
  availableNoteFormats: string[]
  
  // Actions
  // Global shortcuts
  getCurrentGlobalShortcut: () => Promise<void>
  registerGlobalShortcut: (shortcut: string) => Promise<void>
  unregisterGlobalShortcut: (shortcut: string) => Promise<void>
  updateGlobalShortcut: (oldShortcut: string, newShortcut: string) => Promise<void>
  testGlobalShortcut: (shortcut: string) => Promise<boolean>
  getSuggestedGlobalShortcuts: () => Promise<void>
  checkGlobalShortcutRegistration: (shortcut: string) => Promise<boolean>
  
  // Window management
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  setLayoutMode: (mode: LayoutMode) => Promise<void>
  getLayoutMode: () => Promise<void>
  centerWindow: () => Promise<void>
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  checkWindowVisibility: () => Promise<void>
  checkWindowFocus: () => Promise<void>
  
  // System health
  performHealthCheck: () => Promise<void>
  addSystemError: (error: string, context: string) => void
  clearSystemErrors: () => void
  updateConnectionStatus: (status: 'connected' | 'disconnected' | 'checking') => void
  trackRender: (renderTime: number) => void
  updateMemoryUsage: () => void
  
  // Plugin management  
  loadPluginInfo: () => Promise<void>
  getPluginCount: () => Promise<void>
  getAvailableNoteFormats: () => Promise<void>
  reloadPlugins: () => Promise<string>
  
  // Selectors
  isSystemHealthy: () => boolean
  getRecentSystemErrors: (maxAge?: number) => Array<{ error: string; timestamp: number; context: string }>
  getAveragePerformance: () => { avgRenderTime: number; renderCount: number }
}

const MAX_SYSTEM_ERRORS = 50
const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
const ERROR_RETENTION_TIME = 300000 // 5 minutes

export const createSystemSlice: StateCreator<
  SystemSlice,
  [],
  [],
  SystemSlice
> = (set, get) => ({
  // Initial state
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
  availableNoteFormats: ["plaintext", "markdown"],

  // Global shortcuts
  getCurrentGlobalShortcut: async () => {
    try {
      const shortcut = await invoke<string | null>("get_current_global_shortcut")
      set({ currentGlobalShortcut: shortcut })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "getCurrentGlobalShortcut")
    }
  },

  registerGlobalShortcut: async (shortcut: string) => {
    try {
      await invoke("register_global_shortcut", { shortcut })
      set({ 
        currentGlobalShortcut: shortcut,
        isGlobalShortcutRegistered: true
      })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "registerGlobalShortcut")
      throw apiError
    }
  },

  unregisterGlobalShortcut: async (shortcut: string) => {
    try {
      await invoke("unregister_global_shortcut", { shortcut })
      set({ 
        currentGlobalShortcut: null,
        isGlobalShortcutRegistered: false
      })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "unregisterGlobalShortcut")
      throw apiError
    }
  },

  updateGlobalShortcut: async (oldShortcut: string, newShortcut: string) => {
    try {
      await invoke("update_global_shortcut", { oldShortcut, newShortcut })
      set({ currentGlobalShortcut: newShortcut })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "updateGlobalShortcut")
      throw apiError
    }
  },

  testGlobalShortcut: async (shortcut: string) => {
    try {
      return await invoke<boolean>("test_global_shortcut", { shortcut })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "testGlobalShortcut")
      return false
    }
  },

  getSuggestedGlobalShortcuts: async () => {
    try {
      const suggestions = await invoke<string[]>("get_suggested_global_shortcuts")
      set({ globalShortcutSuggestions: suggestions })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "getSuggestedGlobalShortcuts")
    }
  },

  checkGlobalShortcutRegistration: async (shortcut: string) => {
    try {
      const isRegistered = await invoke<boolean>("is_global_shortcut_registered", { shortcut })
      set({ isGlobalShortcutRegistered: isRegistered })
      return isRegistered
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "checkGlobalShortcutRegistration")
      return false
    }
  },

  // Window management
  showWindow: async () => {
    try {
      await invoke("show_window")
      set({ isWindowVisible: true })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "showWindow")
    }
  },

  hideWindow: async () => {
    try {
      await invoke("hide_window")
      set({ isWindowVisible: false })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "hideWindow")
    }
  },

  toggleWindow: async () => {
    try {
      await invoke("toggle_window")
      // Toggle local state
      set(state => ({ isWindowVisible: !state.isWindowVisible }))
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "toggleWindow")
    }
  },

  setLayoutMode: async (mode: LayoutMode) => {
    try {
      await invoke("set_layout_mode", { mode })
      set({ layoutMode: mode })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "setLayoutMode")
    }
  },

  getLayoutMode: async () => {
    try {
      const mode = await invoke<string>("get_layout_mode") as LayoutMode
      set({ layoutMode: mode })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "getLayoutMode")
    }
  },

  centerWindow: async () => {
    try {
      await invoke("center_window")
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "centerWindow")
    }
  },

  setAlwaysOnTop: async (alwaysOnTop: boolean) => {
    try {
      await invoke("set_always_on_top", { alwaysOnTop })
      set({ isAlwaysOnTop: alwaysOnTop })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "setAlwaysOnTop")
    }
  },

  checkWindowVisibility: async () => {
    try {
      const isVisible = await invoke<boolean>("is_window_visible")
      set({ isWindowVisible: isVisible })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "checkWindowVisibility")
    }
  },

  checkWindowFocus: async () => {
    try {
      const isFocused = await invoke<boolean>("is_window_focused")
      set({ isWindowFocused: isFocused })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "checkWindowFocus")
    }
  },

  // System health
  performHealthCheck: async () => {
    set({ connectionStatus: 'checking' })
    
    try {
      // Test basic connectivity with a simple command
      await invoke<boolean>("is_window_visible")
      
      set({ 
        connectionStatus: 'connected',
        lastHealthCheck: Date.now()
      })
    } catch (error) {
      set({ connectionStatus: 'disconnected' })
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "healthCheck")
    }
  },

  addSystemError: (error: string, context: string) => {
    set(state => {
      const newError = { error, timestamp: Date.now(), context }
      const newErrors = [newError, ...state.systemErrors].slice(0, MAX_SYSTEM_ERRORS)
      
      return { systemErrors: newErrors }
    })
  },

  clearSystemErrors: () => set({ systemErrors: [] }),

  updateConnectionStatus: (status) => set({ connectionStatus: status }),

  trackRender: (renderTime: number) => {
    set(state => {
      const newRenderCount = state.performanceMetrics.renderCount + 1
      const totalTime = (state.performanceMetrics.averageRenderTime * state.performanceMetrics.renderCount) + renderTime
      const newAverageTime = totalTime / newRenderCount
      
      return {
        performanceMetrics: {
          ...state.performanceMetrics,
          renderCount: newRenderCount,
          lastRenderTime: renderTime,
          averageRenderTime: newAverageTime
        }
      }
    })
  },

  updateMemoryUsage: () => {
    if (typeof (performance as any).memory !== 'undefined') {
      const memoryInfo = (performance as any).memory
      set(state => ({
        performanceMetrics: {
          ...state.performanceMetrics,
          memoryUsage: memoryInfo.usedJSHeapSize
        }
      }))
    }
  },

  // Plugin management
  loadPluginInfo: async () => {
    try {
      const info = await invoke<Array<Record<string, string>>>("get_plugin_info")
      set({ pluginInfo: info })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "loadPluginInfo")
    }
  },

  getPluginCount: async () => {
    try {
      const count = await invoke<number>("get_plugin_count")
      set({ pluginCount: count })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "getPluginCount")
    }
  },

  getAvailableNoteFormats: async () => {
    try {
      const formats = await invoke<string[]>("get_available_note_formats")
      set({ availableNoteFormats: formats })
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "getAvailableNoteFormats")
      // Use fallback formats
      set({ availableNoteFormats: ["plaintext", "markdown"] })
    }
  },

  reloadPlugins: async () => {
    try {
      const result = await invoke<string>("reload_plugins")
      // Refresh plugin info after reload
      await get().loadPluginInfo()
      await get().getPluginCount()
      await get().getAvailableNoteFormats()
      
      return result
    } catch (error) {
      const apiError = error as ApiError
      get().addSystemError(apiError.message, "reloadPlugins")
      throw apiError
    }
  },

  // Selectors
  isSystemHealthy: () => {
    const { connectionStatus, systemErrors, lastHealthCheck } = get()
    const now = Date.now()
    
    // Check if connection is healthy
    if (connectionStatus !== 'connected') return false
    
    // Check if health check is recent (within 5 minutes)
    if (!lastHealthCheck || (now - lastHealthCheck) > 300000) return false
    
    // Check for recent critical errors
    const recentErrors = systemErrors.filter(e => (now - e.timestamp) < ERROR_RETENTION_TIME)
    return recentErrors.length === 0
  },

  getRecentSystemErrors: (maxAge = ERROR_RETENTION_TIME) => {
    const { systemErrors } = get()
    const now = Date.now()
    return systemErrors.filter(e => (now - e.timestamp) < maxAge)
  },

  getAveragePerformance: () => {
    const { performanceMetrics } = get()
    return {
      avgRenderTime: performanceMetrics.averageRenderTime,
      renderCount: performanceMetrics.renderCount
    }
  }
})