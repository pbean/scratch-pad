import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Settings, LayoutMode, NoteFormat, ApiError } from "../../../types"

export interface SettingsSlice {
  // Settings state
  settings: Partial<Settings>
  isSettingsLoaded: boolean
  isLoadingSettings: boolean
  isDirty: boolean
  lastSavedTimestamp: number | null
  
  // Actions
  loadSettings: () => Promise<void>
  getSetting: (key: keyof Settings) => Promise<string | null>
  setSetting: (key: keyof Settings, value: string) => Promise<void>
  updateSettings: (updates: Partial<Settings>) => void
  saveSettings: () => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (jsonContent: string) => Promise<number>
  resetSettingsToDefaults: () => Promise<void>
  initializeSettings: () => Promise<void>
  markClean: () => void
  
  // Selectors
  getSettingValue: <K extends keyof Settings>(key: K) => Settings[K] | undefined
  hasUnsavedChanges: () => boolean
  isSettingDefault: (key: keyof Settings) => boolean
}

const DEFAULT_SETTINGS: Settings = {
  global_shortcut: "Ctrl+Shift+N",
  ui_font: "system-ui",
  editor_font: "monospace", 
  default_note_format: "plaintext" as NoteFormat,
  layout_mode: "default" as LayoutMode,
  window_width: 800,
  window_height: 600,
  auto_save_delay_ms: 500,
  search_limit: 100,
  fuzzy_search_threshold: 0.6
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice  
> = (set, get) => ({
  // Initial state
  settings: {},
  isSettingsLoaded: false,
  isLoadingSettings: false,
  isDirty: false,
  lastSavedTimestamp: null,

  // Actions
  loadSettings: async () => {
    set({ isLoadingSettings: true })
    try {
      const allSettings = await invoke<Record<string, string>>("get_all_settings")
      
      // Parse settings with proper types
      const typedSettings: Partial<Settings> = {}
      
      Object.entries(allSettings).forEach(([key, value]) => {
        switch (key) {
          case 'window_width':
          case 'window_height':
          case 'auto_save_delay_ms':
          case 'search_limit':
            typedSettings[key as keyof Settings] = parseInt(value, 10) as any
            break
          case 'fuzzy_search_threshold':
            typedSettings[key as keyof Settings] = parseFloat(value) as any
            break
          case 'default_note_format':
            if (['plaintext', 'markdown'].includes(value)) {
              typedSettings[key] = value as NoteFormat
            }
            break
          case 'layout_mode':
            if (['default', 'half', 'full'].includes(value)) {
              typedSettings[key] = value as LayoutMode
            }
            break
          default:
            typedSettings[key as keyof Settings] = value as any
        }
      })
      
      set({
        settings: typedSettings,
        isSettingsLoaded: true,
        isLoadingSettings: false,
        isDirty: false
      })
    } catch (error) {
      set({ isLoadingSettings: false })
      const apiError = error as ApiError
      throw apiError
    }
  },

  getSetting: async (key: keyof Settings) => {
    try {
      return await invoke<string | null>("get_setting", { key })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  setSetting: async (key: keyof Settings, value: string) => {
    try {
      await invoke("set_setting", { key, value })
      
      // Update local state
      set(state => {
        const parsedValue = get().parseSettingValue(key, value)
        return {
          settings: {
            ...state.settings,
            [key]: parsedValue
          },
          lastSavedTimestamp: Date.now(),
          isDirty: false
        }
      })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  updateSettings: (updates: Partial<Settings>) => {
    set(state => ({
      settings: {
        ...state.settings,
        ...updates
      },
      isDirty: true
    }))
  },

  saveSettings: async () => {
    const { settings } = get()
    
    try {
      // Save each setting individually
      const savePromises = Object.entries(settings).map(([key, value]) => 
        invoke("set_setting", { key, value: String(value) })
      )
      
      await Promise.all(savePromises)
      
      set({
        isDirty: false,
        lastSavedTimestamp: Date.now()
      })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  exportSettings: async () => {
    try {
      return await invoke<string>("export_settings")
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  importSettings: async (jsonContent: string) => {
    try {
      const importedCount = await invoke<number>("import_settings", { jsonContent })
      
      // Reload settings after import
      await get().loadSettings()
      
      return importedCount
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  resetSettingsToDefaults: async () => {
    try {
      await invoke("reset_settings_to_defaults")
      
      // Update local state with defaults
      set({
        settings: { ...DEFAULT_SETTINGS },
        isDirty: false,
        lastSavedTimestamp: Date.now()
      })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  initializeSettings: async () => {
    try {
      await invoke("initialize_default_settings")
      await get().loadSettings()
    } catch (error) {
      const apiError = error as ApiError
      console.warn("Failed to initialize default settings:", apiError.message)
    }
  },

  markClean: () => set({ isDirty: false }),

  // Selectors
  getSettingValue: <K extends keyof Settings>(key: K): Settings[K] | undefined => {
    const { settings } = get()
    return settings[key] as Settings[K] | undefined ?? DEFAULT_SETTINGS[key]
  },

  hasUnsavedChanges: () => {
    return get().isDirty
  },

  isSettingDefault: (key: keyof Settings) => {
    const { settings } = get()
    const currentValue = settings[key]
    const defaultValue = DEFAULT_SETTINGS[key]
    return currentValue === defaultValue
  },

  // Helper method (not exposed in interface)
  parseSettingValue: (key: keyof Settings, value: string): any => {
    switch (key) {
      case 'window_width':
      case 'window_height':
      case 'auto_save_delay_ms':
      case 'search_limit':
        return parseInt(value, 10)
      case 'fuzzy_search_threshold':
        return parseFloat(value)
      case 'default_note_format':
        return ['plaintext', 'markdown'].includes(value) ? value : DEFAULT_SETTINGS[key]
      case 'layout_mode':
        return ['default', 'half', 'full'].includes(value) ? value : DEFAULT_SETTINGS[key]
      default:
        return value
    }
  }
})