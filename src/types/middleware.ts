/**
 * Advanced Type Patterns for Store Middleware - Phase 2 Implementation
 * 
 * This file contains sophisticated type definitions for eliminating `any` usage
 * in store middleware components with discriminated unions and type safety.
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import type { Settings, LayoutMode } from './index'

// ============================================================================
// ERROR HANDLING TYPE SAFETY
// ============================================================================

/**
 * Categorized error interface for type-safe error handling
 */
export interface CategorizedError {
  category: 'network' | 'validation' | 'database' | 'system' | 'user' | 'unknown' | 'tauri' | 'runtime' | 'async'
  subtype: string
  message: string
  code?: string
  stack?: string
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
  context?: Record<string, any>
  originalError?: unknown
}

/**
 * Type-safe error handler interface
 */
export interface TypeSafeErrorHandler {
  (error: CategorizedError): void
  handle?: (error: CategorizedError) => void
  canHandle?: (error: unknown) => boolean
  priority?: number
}

/**
 * Error reporting configuration
 */
export interface ErrorReportingConfig {
  enabled: boolean
  endpoint?: string
  apiKey?: string
  includeStackTrace: boolean
  includeBrowserInfo: boolean
  includeUserAgent: boolean
  maxRetries: number
  retryDelay: number
  enableBackendReporting?: boolean
  enableConsoleLogging?: boolean
  enableToast?: boolean
  filterPredicate?: (error: CategorizedError) => boolean
}

// ============================================================================
// SETTINGS VALIDATION TYPE SAFETY
// ============================================================================

/**
 * Setting validation result interface
 */
export interface SettingParseResult<T> {
  success: boolean
  value?: T
  error?: string
  fallback?: T
}

/**
 * Type-safe setting validator function
 */
export interface SettingValidator<T = any> {
  (value: string): SettingParseResult<T>
}

/**
 * Setting validator registry interface
 */
export interface SettingValidatorRegistry {
  [K: string]: SettingValidator
}

// ============================================================================
// PERFORMANCE MIDDLEWARE TYPE SAFETY
// ============================================================================

/**
 * Performance metrics interface with complete type safety
 */
export interface PerformanceMetrics {
  totalStateUpdates: number
  lastUpdateTime: number
  updateTimes: number[]
  slowUpdates: Array<{ 
    timestamp: number
    duration: number
    action?: string 
  }>
  rerenderPrevention: {
    prevented: number
    total: number
  }
}

/**
 * Performance slice interface for type-safe middleware
 */
export interface PerformanceSlice {
  _performance: PerformanceMetrics
  _getPerformanceStats: () => PerformanceMetrics & {
    averageUpdateTime: number
    recentUpdateCount: number
    rerenderPreventionRate: number
  }
  _trackRerender: (prevented: boolean) => void
  _resetPerformanceStats: () => void
}

// ============================================================================
// DEVTOOLS TYPE SAFETY
// ============================================================================

/**
 * Type-safe JSON serialization with circular reference handling
 */
export interface SerializationContext {
  depth: number
  visited: WeakSet<object>
}

export type JSONSerializable = 
  | string 
  | number 
  | boolean 
  | null 
  | JSONSerializableObject 
  | JSONSerializableArray

export interface JSONSerializableObject {
  [key: string]: JSONSerializable
}

export interface JSONSerializableArray extends Array<JSONSerializable> {}

/**
 * Advanced replacer function with type safety
 */
export type TypeSafeReplacer = (
  key: string, 
  value: unknown, 
  context: SerializationContext
) => JSONSerializable | undefined

/**
 * Advanced reviver function with type safety
 */
export type TypeSafeReviver = (
  key: string, 
  value: JSONSerializable
) => unknown

/**
 * Type-safe devtools configuration
 */
export interface TypeSafeDevtoolsConfig {
  name?: string
  enabled?: boolean
  serialize?: boolean | {
    options?: {
      undefined?: boolean
      function?: boolean
      symbol?: boolean
    }
    replacer?: TypeSafeReplacer
    reviver?: TypeSafeReviver
  }
  actionCreators?: Record<string, (...args: unknown[]) => unknown>
  latency?: number
  predicate?: TypeSafePredicate
  trace?: boolean
  traceLimit?: number
}

/**
 * Type-safe predicate for filtering devtools actions
 */
export type TypeSafePredicate = <T>(
  state: T, 
  action: DevtoolsAction
) => boolean

/**
 * Devtools action with discriminated union
 */
export type DevtoolsAction = 
  | { type: 'note_action'; payload: NoteActionPayload }
  | { type: 'search_action'; payload: SearchActionPayload }
  | { type: 'ui_action'; payload: UIActionPayload }
  | { type: 'settings_action'; payload: SettingsActionPayload }
  | { type: 'system_action'; payload: SystemActionPayload }
  | { type: 'performance_action'; payload: PerformanceActionPayload }

export interface NoteActionPayload {
  action: 'create' | 'update' | 'delete' | 'set_active'
  noteId?: number
  content?: string
}

export interface SearchActionPayload {
  action: 'search' | 'clear' | 'set_filters'
  query?: string
  filters?: Record<string, unknown>
}

export interface UIActionPayload {
  action: 'set_view' | 'toggle_sidebar' | 'set_error'
  view?: string
  error?: string
}

export interface SettingsActionPayload {
  action: 'update' | 'save' | 'reset'
  settings?: Partial<Settings>
}

export interface SystemActionPayload {
  action: 'health_check' | 'update_connection'
  status?: string
}

export interface PerformanceActionPayload {
  action: 'measure' | 'report'
  metrics?: Record<string, number>
}

// ============================================================================
// PERSISTENCE TYPE SAFETY
// ============================================================================

/**
 * Type-safe persistence configuration with discriminated unions
 */
export type PersistenceConfig<T> = {
  name: string
  version: number
  partialize: TypeSafePartializer<T>
  merge: TypeSafeMerger<T>
  migrate?: TypeSafeMigrator<T>
  storage?: TypeSafeStorage
  onRehydrateStorage?: TypeSafeRehydrationHandler<T>
}

/**
 * Type-safe partializer for selective state persistence
 * Fixed: Simplified to use T directly instead of complex PersistableState
 */
export type TypeSafePartializer<T> = (state: T) => T

/**
 * Type-safe merger for rehydrating persisted state
 * Fixed: Simplified to use T directly for consistent typing
 */
export type TypeSafeMerger<T> = (
  persistedState: T, 
  currentState: T
) => T

/**
 * Type-safe migrator for handling schema changes
 */
export type TypeSafeMigrator<T> = (
  persistedState: unknown, 
  version: number
) => T | unknown

/**
 * Type-safe storage interface
 */
export interface TypeSafeStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/**
 * Type-safe rehydration handler
 */
export type TypeSafeRehydrationHandler<T> = (
  state?: T
) => (rehydratedState?: T, error?: Error) => void

/**
 * Discriminated union for slice persistence types
 */
export type SlicePersistenceType = 'ui' | 'search' | 'notes' | 'settings' | 'system'

/**
 * Type mapping for each slice's persistable state
 */
export interface PersistenceStateMap {
  ui: UIPersistedState
  search: SearchPersistedState
  notes: NotesPersistedState
  settings: SettingsPersistedState
  system: SystemPersistedState
}

/**
 * UI slice persistent state
 */
export interface UIPersistedState {
  currentView: string
  expandedFolders: string[]
  sidebarWidth: number
  isFullscreen: boolean
}

/**
 * Search slice persistent state
 */
export interface SearchPersistedState {
  recentSearches: string[]
  searchHistory: string[]
}

/**
 * Notes slice persistent state
 */
export interface NotesPersistedState {
  activeNoteId: number | null
}

/**
 * Settings slice persistent state
 */
export interface SettingsPersistedState {
  isDirty: boolean
}

/**
 * System slice persistent state
 */
export interface SystemPersistedState {
  layoutMode: LayoutMode
  isAlwaysOnTop: boolean
}

// ============================================================================
// ENHANCED SEARCH MIDDLEWARE TYPE SAFETY
// ============================================================================

/**
 * Search highlighting configuration
 */
export interface SearchHighlight {
  enabled: boolean
  className?: string
  maxHighlights?: number
}

/**
 * Advanced search options with type safety
 */
export interface SearchOptions {
  caseSensitive: boolean
  wholeWords: boolean
  useRegex: boolean
  fuzzySearch: boolean
  highlight: SearchHighlight
}

/**
 * Search result with highlighting information
 */
export interface SearchResult<T = unknown> {
  item: T
  matches: SearchMatch[]
  score: number
  highlights: string[]
}

/**
 * Individual search match details
 */
export interface SearchMatch {
  field: string
  value: string
  indices: [number, number][]
  score: number
}

/**
 * Type-safe search slice interface
 */
export interface SearchSlice<T = unknown> {
  query: string
  results: SearchResult<T>[]
  isSearching: boolean
  options: SearchOptions
  filters: SearchFilters
  history: SearchHistory[]
  suggestions: SearchSuggestion[]
}

/**
 * Search filters with type constraints
 */
export interface SearchFilters {
  dateRange?: {
    start?: Date
    end?: Date
  }
  tags?: string[]
  type?: string
  status?: 'active' | 'archived' | 'deleted'
}

/**
 * Search history entry
 */
export interface SearchHistory {
  query: string
  timestamp: Date
  resultCount: number
  filters?: SearchFilters
}

/**
 * Search suggestion with confidence scoring
 */
export interface SearchSuggestion {
  text: string
  type: 'query' | 'filter' | 'tag'
  confidence: number
  metadata?: Record<string, unknown>
}

// ============================================================================
// UI ENHANCEMENT MIDDLEWARE TYPE SAFETY
// ============================================================================

/**
 * UI enhancement configuration
 */
export interface UIEnhancement {
  animations: boolean
  transitions: boolean
  accessibility: boolean
  theme: 'light' | 'dark' | 'auto'
  density: 'compact' | 'normal' | 'comfortable'
}

/**
 * Type-safe UI slice interface
 */
export interface UISlice {
  currentView: string
  previousView?: string
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  modals: UIModal[]
  notifications: UINotification[]
  enhancement: UIEnhancement
  isFullscreen: boolean
  error: string | null
  loading: boolean
}

/**
 * UI modal configuration
 */
export interface UIModal {
  id: string
  type: 'confirmation' | 'form' | 'info' | 'error'
  title: string
  content: string
  data?: Record<string, unknown>
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * UI notification with type safety
 */
export interface UINotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
  duration?: number
  actions?: UINotificationAction[]
  metadata?: Record<string, unknown>
}

/**
 * Notification action button
 */
export interface UINotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary' | 'danger'
}

// ============================================================================
// MIDDLEWARE COMPOSITION TYPE SAFETY
// ============================================================================

/**
 * Advanced middleware composition with proper type inference
 */
export type MiddlewareComposer<
  T,
  TSlice = {},
  TMps extends [StoreMutatorIdentifier, unknown][] = [],
  TMcs extends [StoreMutatorIdentifier, unknown][] = []
> = (
  config: StateCreator<T, TMps, TMcs>
) => StateCreator<T & TSlice, [...TMps, ...TMps], [...TMcs, ...TMcs]>

/**
 * Middleware pipeline type for composing multiple middlewares
 */
export type MiddlewarePipeline<
  T,
  TMiddlewares extends readonly unknown[] = []
> = TMiddlewares extends readonly [infer TFirst, ...infer TRest]
  ? TFirst extends MiddlewareComposer<T, infer _TSlice>
    ? (config: StateCreator<any>) => StateCreator<TFirst & ComposeMiddlewareSlices<TRest>>
    : never
  : StateCreator<T>

/**
 * Helper type to compose middleware slice types
 */
export type ComposeMiddlewareSlices<T extends readonly unknown[]> = 
  T extends readonly [infer TFirst, ...infer TRest]
    ? TFirst & ComposeMiddlewareSlices<TRest>
    : {}

// ============================================================================
// STORE VALIDATION MIDDLEWARE TYPE SAFETY
// ============================================================================

/**
 * Validation rule with type constraints
 */
export interface ValidationRule<T = unknown> {
  field: keyof T
  validator: (value: unknown) => boolean
  message: string
  severity: 'error' | 'warning'
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string
  message: string
  value: unknown
  severity: 'error' | 'warning'
}

/**
 * Type-safe validation slice
 */
export interface ValidationSlice<T = unknown> {
  validationRules: ValidationRule<T>[]
  lastValidation?: ValidationResult
  autoValidate: boolean
  isValid: boolean
  _validate: (data: T) => ValidationResult
  _addRule: (rule: ValidationRule<T>) => void
  _removeRule: (field: keyof T) => void
  _clearRules: () => void
}

// ============================================================================
// EXPORT TYPE UTILITIES
// ============================================================================

/**
 * Extract slice type from middleware
 */
export type ExtractSliceType<T> = T extends MiddlewareComposer<any, infer TSlice> ? TSlice : never

/**
 * Create typed store with all middleware applied
 */
export type TypedStore<
  TBase,
  TMiddlewares extends readonly MiddlewareComposer<any>[] = []
> = TBase & ComposeMiddlewareSlices<{
  [K in keyof TMiddlewares]: ExtractSliceType<TMiddlewares[K]>
}>

/**
 * Helper type for middleware-enhanced state creators
 */
export type EnhancedStateCreator<
  T,
  TSlices extends readonly unknown[] = []
> = StateCreator<T & ComposeMiddlewareSlices<TSlices>>