import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Settings, NoteFormat, ApiError } from "../../../types"
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
  theme: "system",
  autoSave: true,
  autoSaveDelay: 500,
  showLineNumbers: false,
  wordWrap: true,
  fontSize: 14,
  fontFamily: "system-ui",
  globalShortcut: "Ctrl+Shift+N",
  saveOnBlur: true,
  confirmDelete: true,
  showWordCount: true,
  enableSpellCheck: false,
  defaultNoteFormat: "plaintext" as NoteFormat,
  note_directory: "",
  searchHighlighting: {
    enabled: true,
    maxSnippets: 3,
    contextLength: 100
  },
  performance: {
    enableAnalytics: true,
    enableCaching: true,
    cacheMaxAge: 300000,
    maxCacheSize: 100
  },
  security: {
    encryptNotes: false,
    requirePassword: false,
    sessionTimeout: 3600000
  },
  accessibility: {
    highContrast: false,
    reduceMotion: false,
    screenReaderOptimized: false
  }
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
// Removed unused createFloatValidator - keeping for future use if needed
// const createFloatValidator = ...

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
  theme: createEnumValidator(['light', 'dark', 'system'] as const, DEFAULT_SETTINGS.theme),
  autoSave: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  autoSaveDelay: createNumberValidator(100, 10000, DEFAULT_SETTINGS.autoSaveDelay),
  showLineNumbers: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  wordWrap: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  fontSize: createNumberValidator(8, 48, DEFAULT_SETTINGS.fontSize),
  fontFamily: createStringValidator(100, DEFAULT_SETTINGS.fontFamily, false),
  globalShortcut: createStringValidator(50, DEFAULT_SETTINGS.globalShortcut, false),
  saveOnBlur: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  confirmDelete: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  showWordCount: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  enableSpellCheck: (value: string) => ({ success: true, value: value.toLowerCase() === 'true' }),
  defaultNoteFormat: createEnumValidator(['plaintext', 'markdown'] as const, DEFAULT_SETTINGS.defaultNoteFormat),
  note_directory: createStringValidator(500, DEFAULT_SETTINGS.note_directory, true)
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
        parseErrors.push({ key, error: parseResult.error || 'Unknown error' })
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
          if (parseResult.success) {
            (validatedUpdates as any)[key] = parseResult.value
          } else {
            (validatedUpdates as any)[key] = parseResult.fallback
          }
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
    case 'theme':
      return 'One of: "light", "dark", or "system"'
    case 'autoSave':
      return 'Boolean: true or false'
    case 'autoSaveDelay':
      return 'Number between 100 and 10,000 milliseconds'
    case 'showLineNumbers':
      return 'Boolean: true or false'
    case 'wordWrap':
      return 'Boolean: true or false'
    case 'fontSize':
      return 'Number between 8 and 48'
    case 'fontFamily':
      return 'Font name or CSS font-family (max 100 characters)'
    case 'globalShortcut':
      return 'Keyboard shortcut string (max 50 characters)'
    case 'saveOnBlur':
      return 'Boolean: true or false'
    case 'confirmDelete':
      return 'Boolean: true or false'
    case 'showWordCount':
      return 'Boolean: true or false'
    case 'enableSpellCheck':
      return 'Boolean: true or false'
    case 'defaultNoteFormat':
      return 'Either "plaintext" or "markdown"'
    case 'note_directory':
      return 'Directory path (max 500 characters, can be empty)'
    default:
      return 'Valid setting value'
  }
}