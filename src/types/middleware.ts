/**
 * Advanced Type Patterns for Store Middleware - Phase 2 Implementation
 * 
 * This file contains sophisticated type definitions for eliminating `any` usage
 * in store middleware components with discriminated unions and type safety.
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand'
import type { Settings, LayoutMode, NoteFormat } from './index'

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
 */
export type TypeSafePartializer<T> = (state: T) => PersistableState<T>

/**
 * Type-safe merger for rehydrating persisted state
 */
export type TypeSafeMerger<T> = (
  persistedState: PersistableState<T>, 
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
 * Generic persistable state constraint
 */
type PersistableState<T> = PersistenceStateMap[keyof PersistenceStateMap] | Partial<T>

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
// ERROR HANDLING TYPE SAFETY
// ============================================================================

/**
 * Error categorization with discriminated unions
 */
export type CategorizedError = 
  | { category: 'tauri'; subtype: 'ipc_failure' | 'window_error' | 'permission_denied'; originalError: unknown }
  | { category: 'network'; subtype: 'fetch_error' | 'timeout' | 'connection_lost'; originalError: unknown }
  | { category: 'runtime'; subtype: 'type_error' | 'reference_error' | 'syntax_error'; originalError: unknown }
  | { category: 'async'; subtype: 'unhandled_rejection' | 'promise_error'; originalError: unknown }
  | { category: 'unknown'; subtype: 'unclassified'; originalError: unknown }

/**
 * Type-safe error handler function
 */
export type TypeSafeErrorHandler = (error: CategorizedError) => void

/**
 * Error reporting configuration with type safety
 */
export interface ErrorReportingConfig {
  enableToast: boolean
  enableBackendReporting: boolean
  enableConsoleLogging: boolean
  filterPredicate?: (error: CategorizedError) => boolean
}

// ============================================================================
// SETTINGS VALIDATION TYPE SAFETY
// ============================================================================

/**
 * Setting parse result with discriminated union
 */
export type SettingParseResult<T> = 
  | { success: true; value: T }
  | { success: false; error: string; fallback: T }

/**
 * Type-safe setting validator function
 */
export type SettingValidator<T> = (value: string) => SettingParseResult<T>

/**
 * Setting validator registry with complete type safety
 */
export interface SettingValidatorRegistry {
  window_width: SettingValidator<number>
  window_height: SettingValidator<number>
  auto_save_delay_ms: SettingValidator<number>
  search_limit: SettingValidator<number>
  fuzzy_search_threshold: SettingValidator<number>
  default_note_format: SettingValidator<NoteFormat>
  layout_mode: SettingValidator<LayoutMode>
  global_shortcut: SettingValidator<string>
  ui_font: SettingValidator<string>
  editor_font: SettingValidator<string>
  theme: SettingValidator<string>
  note_directory: SettingValidator<string>
}

// ============================================================================
// ADVANCED MIDDLEWARE PATTERNS
// ============================================================================

/**
 * Type-safe middleware creator pattern
 */
export type TypeSafeMiddleware<
  TSlice,
  TMps extends [StoreMutatorIdentifier, unknown][] = [],
  TMcs extends [StoreMutatorIdentifier, unknown][] = []
> = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>
) => StateCreator<T & TSlice, [...Mps, ...TMps], [...Mcs, ...TMcs]>

/**
 * Middleware composition helper with type safety
 */
export type ComposeMiddleware<
  TMiddlewares extends readonly TypeSafeMiddleware<any>[]
> = TMiddlewares extends readonly [
  TypeSafeMiddleware<infer TFirst>,
  ...infer TRest
] 
  ? TRest extends readonly TypeSafeMiddleware<any>[]
    ? (config: StateCreator<any>) => StateCreator<TFirst & ComposeMiddlewareSlices<TRest>>
    : TypeSafeMiddleware<TFirst>
  : never

type ComposeMiddlewareSlices<
  TMiddlewares extends readonly TypeSafeMiddleware<any>[]
> = TMiddlewares extends readonly [
  TypeSafeMiddleware<infer TFirst>,
  ...infer TRest
] 
  ? TRest extends readonly TypeSafeMiddleware<any>[]
    ? TFirst & ComposeMiddlewareSlices<TRest>
    : TFirst
  : {}

/**
 * Development helpers with type safety
 */
export interface TypeSafeDevHelpers<T> {
  logStateChanges: (state: T, actionName?: string) => void
  trackPerformance: (state: T) => PerformanceMetrics
  validateState: (state: T) => Array<{ path: string; issue: string }>
}

/**
 * Middleware configuration builder with type safety
 */
export interface TypeSafeMiddlewareConfig<T> {
  devtools?: Partial<TypeSafeDevtoolsConfig>
  persistence?: Partial<PersistenceConfig<T>>
  performance?: {
    enabled: boolean
    slowThreshold: number
    maxTrackedUpdates: number
  }
  errorHandling?: Partial<ErrorReportingConfig>
}

/**
 * Middleware builder function with complete type safety
 */
export type TypeSafeMiddlewareBuilder = <T>(
  config: TypeSafeMiddlewareConfig<T>
) => TypeSafeMiddleware<T & PerformanceSlice>

// ============================================================================
// UTILITY TYPES FOR ADVANCED PATTERNS
// ============================================================================

/**
 * Extract slice types from middleware
 */
export type ExtractSliceType<TMiddleware> = TMiddleware extends TypeSafeMiddleware<infer TSlice>
  ? TSlice
  : never

/**
 * Combine multiple slice types
 */
export type CombineSliceTypes<TSlices extends readonly unknown[]> = TSlices extends readonly [
  infer TFirst,
  ...infer TRest
]
  ? TFirst & CombineSliceTypes<TRest>
  : {}

/**
 * Type-safe selector creator
 */
export type TypeSafeSelector<TState, TSelected> = (state: TState) => TSelected

/**
 * Store with all middleware applied
 */
export type TypeSafeStoreWithMiddleware<
  TState,
  TMiddlewares extends readonly TypeSafeMiddleware<any>[]
> = TState & CombineSliceTypes<{
  [K in keyof TMiddlewares]: ExtractSliceType<TMiddlewares[K]>
}>

export default TypeSafeMiddleware