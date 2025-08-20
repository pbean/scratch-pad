import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Settings, LayoutMode, NoteFormat, ApiError } from "../../../types"
import type { 
  SettingParseResult, 
  SettingValidator, 
  SettingValidatorRegistry 
} from "../../../types/middleware"

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

// ============================================================================
// TYPE-SAFE SETTING VALIDATION
// ============================================================================

/**
 * Create validator for number settings with bounds checking
 */
const createNumberValidator = (
  min: number, 
  max: number, 
  defaultValue: number
): SettingValidator<number> => {
  return (value: string): SettingParseResult<number> => {
    const parsed = parseInt(value, 10)
    
    if (isNaN(parsed)) {
      return {
        success: false,
        error: `Invalid number format: ${value}`,
        fallback: defaultValue
      }
    }
    
    if (parsed < min || parsed > max) {
      return {
        success: false,
        error: `Value ${parsed} is outside valid range [${min}, ${max}]`,
        fallback: Math.max(min, Math.min(max, parsed))
      }
    }
    
    return { success: true, value: parsed }
  }
}

/**
 * Create validator for float settings with bounds checking
 */
const createFloatValidator = (
  min: number, 
  max: number, 
  defaultValue: number
): SettingValidator<number> => {
  return (value: string): SettingParseResult<number> => {
    const parsed = parseFloat(value)
    
    if (isNaN(parsed)) {
      return {
        success: false,
        error: `Invalid float format: ${value}`,
        fallback: defaultValue
      }
    }
    
    if (parsed < min || parsed > max) {
      return {
        success: false,
        error: `Value ${parsed} is outside valid range [${min}, ${max}]`,
        fallback: Math.max(min, Math.min(max, parsed))
      }
    }
    
    return { success: true, value: parsed }
  }
}

/**
 * Create validator for enum settings
 */
const createEnumValidator = <T extends string>(
  validValues: readonly T[], 
  defaultValue: T
): SettingValidator<T> => {
  return (value: string): SettingParseResult<T> => {
    if (validValues.includes(value as T)) {
      return { success: true, value: value as T }
    }
    
    return {
      success: false,
      error: `Invalid value "${value}". Must be one of: ${validValues.join(', ')}`,
      fallback: defaultValue
    }
  }
}

/**
 * Create validator for string settings with length checking
 */
const createStringValidator = (
  maxLength: number, 
  defaultValue: string,
  allowEmpty: boolean = true
): SettingValidator<string> => {
  return (value: string): SettingParseResult<string> => {
    if (!allowEmpty && value.trim().length === 0) {
      return {
        success: false,
        error: 'Value cannot be empty',
        fallback: defaultValue
      }
    }
    
    if (value.length > maxLength) {
      return {
        success: false,
        error: `Value exceeds maximum length of ${maxLength} characters`,
        fallback: value.substring(0, maxLength)
      }
    }
    
    return { success: true, value }
  }
}

/**
 * Type-safe setting validator registry
 */
const SETTING_VALIDATORS: SettingValidatorRegistry = {
  window_width: createNumberValidator(400, 3840, DEFAULT_SETTINGS.window_width),
  window_height: createNumberValidator(300, 2160, DEFAULT_SETTINGS.window_height),
  auto_save_delay_ms: createNumberValidator(100, 10000, DEFAULT_SETTINGS.auto_save_delay_ms),
  search_limit: createNumberValidator(10, 1000, DEFAULT_SETTINGS.search_limit),
  fuzzy_search_threshold: createFloatValidator(0.0, 1.0, DEFAULT_SETTINGS.fuzzy_search_threshold),
  default_note_format: createEnumValidator(['plaintext', 'markdown'] as const, DEFAULT_SETTINGS.default_note_format),
  layout_mode: createEnumValidator(['default', 'half', 'full'] as const, DEFAULT_SETTINGS.layout_mode),
  global_shortcut: createStringValidator(50, DEFAULT_SETTINGS.global_shortcut, false),
  ui_font: createStringValidator(100, DEFAULT_SETTINGS.ui_font, false),
  editor_font: createStringValidator(100, DEFAULT_SETTINGS.editor_font, false)
}

/**
 * Type-safe setting parser with validation
 */
const parseSettingValueTypeSafe = <K extends keyof Settings>(
  key: K, 
  value: string
): SettingParseResult<Settings[K]> => {
  const validator = SETTING_VALIDATORS[key]
  return validator(value) as SettingParseResult<Settings[K]>
}

/**
 * Parse all settings from backend response with type safety
 */
const parseAllSettings = (rawSettings: Record<string, string>): Partial<Settings> => {
  const typedSettings: Partial<Settings> = {}
  const parseErrors: Array<{ key: string; error: string }> = []
  
  for (const [key, value] of Object.entries(rawSettings)) {
    if (key in SETTING_VALIDATORS) {
      const parseResult = parseSettingValueTypeSafe(key as keyof Settings, value)
      
      if (parseResult.success) {
        (typedSettings as any)[key] = parseResult.value
      } else {
        // Use fallback value and log error
        (typedSettings as any)[key] = parseResult.fallback
        parseErrors.push({ key, error: parseResult.error })
      }
    } else {
      // Unknown setting - keep as string for backward compatibility
      console.warn(`Unknown setting key: ${key}`)
    }
  }
  
  // Log parse errors in development
  if (process.env.NODE_ENV === 'development' && parseErrors.length > 0) {
    console.group('⚠️ Settings Parse Errors')
    parseErrors.forEach(({ key, error }) => {
      console.warn(`${key}: ${error}`)
    })
    console.groupEnd()
  }
  
  return typedSettings
}

// ============================================================================
// SETTINGS SLICE IMPLEMENTATION
// ============================================================================

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
      
      // Parse settings with type safety and validation
      const typedSettings = parseAllSettings(allSettings)
      
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
      
      // Parse and validate the new value
      const parseResult = parseSettingValueTypeSafe(key, value)
      const finalValue = parseResult.success ? parseResult.value : parseResult.fallback
      
      // Update local state with validated value
      set(state => ({
        settings: {
          ...state.settings,
          [key]: finalValue
        },
        lastSavedTimestamp: Date.now(),
        isDirty: false
      }))
      
      // Log validation issues in development
      if (!parseResult.success && process.env.NODE_ENV === 'development') {
        console.warn(`Setting validation issue for ${String(key)}:`, parseResult.error)
      }
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  updateSettings: (updates: Partial<Settings>) => {
    // Validate updates before applying
    const validatedUpdates: Partial<Settings> = {}
    
    for (const [key, value] of Object.entries(updates)) {
      if (key in SETTING_VALIDATORS && value !== undefined) {
        // For local updates, convert to string and parse to ensure consistency
        const stringValue = String(value)
        try {
          const parseResult = parseSettingValueTypeSafe(key as keyof Settings, stringValue)
          (validatedUpdates as any)[key] = parseResult.success 
            ? parseResult.value
            : parseResult.fallback
        } catch {
          (validatedUpdates as any)[key] = value
        }
      } else {
        (validatedUpdates as any)[key] = value
      }
    }
    
    set(state => ({
      settings: {
        ...state.settings,
        ...validatedUpdates
      },
      isDirty: true
    }))
  },

  saveSettings: async () => {
    const { settings } = get()
    
    try {
      // Save each setting individually with validation
      const savePromises = Object.entries(settings).map(([key, value]) => {
        if (value !== undefined) {
          return invoke("set_setting", { key, value: String(value) })
        }
        return Promise.resolve()
      })
      
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
      
      // Reload settings after import to ensure consistency
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

  // Selectors with type safety
  getSettingValue: <K extends keyof Settings>(key: K): Settings[K] | undefined => {
    const { settings } = get()
    return settings[key] ?? DEFAULT_SETTINGS[key]
  },

  hasUnsavedChanges: () => {
    return get().isDirty
  },

  isSettingDefault: (key: keyof Settings) => {
    const { settings } = get()
    const currentValue = settings[key]
    const defaultValue = DEFAULT_SETTINGS[key]
    return currentValue === defaultValue
  }
})

// ============================================================================
// UTILITY FUNCTIONS FOR EXTERNAL USE
// ============================================================================

/**
 * Validate a setting value without storing it
 */
export const validateSettingValue = <K extends keyof Settings>(
  key: K,
  value: string
): SettingParseResult<Settings[K]> => {
  return parseSettingValueTypeSafe(key, value)
}

/**
 * Get default value for a setting
 */
export const getDefaultSettingValue = <K extends keyof Settings>(key: K): Settings[K] => {
  return DEFAULT_SETTINGS[key]
}

/**
 * Check if a setting key is valid
 */
export const isValidSettingKey = (key: string): key is keyof Settings => {
  return key in SETTING_VALIDATORS
}

/**
 * Get all valid setting keys
 */
export const getValidSettingKeys = (): Array<keyof Settings> => {
  return Object.keys(SETTING_VALIDATORS) as Array<keyof Settings>
}

/**
 * Get validation rules for a setting (for UI purposes)
 */
export const getSettingValidationRules = (key: keyof Settings): string => {
  switch (key) {
    case 'window_width':
      return 'Number between 400 and 3840'
    case 'window_height':
      return 'Number between 300 and 2160'
    case 'auto_save_delay_ms':
      return 'Number between 100 and 10,000 milliseconds'
    case 'search_limit':
      return 'Number between 10 and 1,000'
    case 'fuzzy_search_threshold':
      return 'Decimal between 0.0 and 1.0'
    case 'default_note_format':
      return 'Either "plaintext" or "markdown"'
    case 'layout_mode':
      return 'One of: "default", "half", or "full"'
    case 'global_shortcut':
      return 'Keyboard shortcut string (max 50 characters)'
    case 'ui_font':
      return 'Font name or CSS font-family (max 100 characters)'
    case 'editor_font':
      return 'Font name or CSS font-family (max 100 characters)'
    default:
      return 'Valid setting value'
  }
}