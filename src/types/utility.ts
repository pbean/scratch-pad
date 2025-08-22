/**
 * Utility Types for Enhanced Type Safety - Phase 1 Implementation
 * 
 * This file contains utility types that support the TypeScript safety improvements
 * across the entire application, particularly for store management and analytics.
 */

import { type ReactNode, type MouseEvent, type KeyboardEvent } from "react"

// ============================================================================
// BRANDED TYPES FOR ENHANCED TYPE SAFETY
// ============================================================================

/**
 * Branded type utility for creating nominal types
 * Prevents accidental value mixing between similar types
 */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand }

/**
 * Branded types for specific domain values
 */
export type NoteId = Brand<number, 'NoteId'>
export type TimestampMs = Brand<number, 'TimestampMs'>
export type QueryTime = Brand<number, 'QueryTime'>
export type MemoryBytes = Brand<number, 'MemoryBytes'>
export type CacheKey = Brand<string, 'CacheKey'>
export type EventId = Brand<string, 'EventId'>

/**
 * Create branded values with type safety
 */
export const createBrandedValue = {
  noteId: (value: number): NoteId => value as NoteId,
  timestamp: (value: number): TimestampMs => value as TimestampMs,
  queryTime: (value: number): QueryTime => value as QueryTime,
  memoryBytes: (value: number): MemoryBytes => value as MemoryBytes,
  cacheKey: (value: string): CacheKey => value as CacheKey,
  eventId: (value: string): EventId => value as EventId,
}

// ============================================================================
// STORE TYPE UTILITIES
// ============================================================================

/**
 * Generic store selector type for type-safe state access
 */
export type StoreSelector<TState, TReturn> = (state: TState) => TReturn

/**
 * Utility for creating type-safe computed selectors
 */
export type ComputedSelector<TState, TDeps extends readonly unknown[], TReturn> = {
  (state: TState): TReturn
  dependencies: (state: TState) => TDeps
  compute: (...deps: TDeps) => TReturn
}

/**
 * Helper for creating memoized selectors with dependency tracking
 */
export function createComputedSelector<TState, TDeps extends readonly unknown[], TReturn>(
  dependencies: (state: TState) => TDeps,
  compute: (...deps: TDeps) => TReturn
): ComputedSelector<TState, TDeps, TReturn> {
  const selector = (state: TState): TReturn => {
    const deps = dependencies(state)
    return compute(...deps)
  }
  
  selector.dependencies = dependencies
  selector.compute = compute
  
  return selector
}

/**
 * Type-safe slice selectors for modular store access
 */
export type SliceSelector<TSlice, TReturn> = (slice: TSlice) => TReturn

/**
 * Utility for extracting slice types from store
 */
export type ExtractSlice<TStore, TSliceKey extends keyof TStore> = TStore[TSliceKey]

// ============================================================================
// ANALYTICS TYPE UTILITIES
// ============================================================================

/**
 * Utility for extracting event data type by event type
 */
export type ExtractEventData<TEvent, TType> = TEvent extends { type: TType; data: infer TData } 
  ? TData 
  : never

/**
 * Type-safe event handler function signatures
 */
export type EventHandler<TEventData> = (data: TEventData) => void | Promise<void>

/**
 * Event listener registry type for type-safe event handling
 */
export type EventListenerRegistry<TEvents> = {
  [K in keyof TEvents]: EventHandler<TEvents[K]>[]
}

/**
 * Utility for creating type-safe event emitters
 */
export interface TypeSafeEventEmitter<TEvents> {
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void
  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void
  removeAllListeners(): void
}

// ============================================================================
// PERFORMANCE TYPE UTILITIES
// ============================================================================

/**
 * Performance measurement result with type safety
 */
export interface PerformanceMeasurement {
  name: string
  startTime: TimestampMs
  endTime: TimestampMs
  duration: QueryTime
  metadata?: Record<string, unknown>
}

/**
 * Type-safe performance tracker interface
 */
export interface PerformanceTracker {
  startMeasurement(name: string, metadata?: Record<string, unknown>): TimestampMs
  endMeasurement(name: string, startTime: TimestampMs): PerformanceMeasurement
  getMeasurements(): PerformanceMeasurement[]
  clearMeasurements(): void
}

/**
 * Memory usage tracking with type safety
 */
export interface TypeSafeMemoryUsage {
  used: MemoryBytes
  total: MemoryBytes
  limit: MemoryBytes
  timestamp: TimestampMs
  usagePercent: number
}

// ============================================================================
// VALIDATION TYPE UTILITIES
// ============================================================================

/**
 * Type-safe validation result
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

/**
 * Validation function type
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>

/**
 * Schema validation for complex objects
 */
export type ValidationSchema<T> = {
  [K in keyof T]: Validator<T[K]>
}

/**
 * Utility for creating object validators
 */
export function createObjectValidator<T>(schema: ValidationSchema<T>): Validator<T> {
  return (value: unknown): ValidationResult<T> => {
    if (!value || typeof value !== 'object') {
      return { success: false, error: 'Value must be an object' }
    }
    
    const obj = value as Record<string, unknown>
    const result = {} as T
    
    for (const [key, validator] of Object.entries(schema)) {
      const validation = (validator as any)(obj[key])
      if (!validation.success) {
        return { success: false, error: `Invalid ${key}: ${validation.error}` }
      }
      (result as any)[key] = validation.data
    }
    
    return { success: true, data: result }
  }
}

// ============================================================================
// ASYNC TYPE UTILITIES
// ============================================================================

/**
 * Type-safe async operation state
 */
export type AsyncState<T, E = Error> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }

/**
 * Async operation result with type safety
 */
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>

/**
 * Type-safe async function wrapper
 */
export function wrapAsync<TArgs extends readonly unknown[], TReturn, TError = Error>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => AsyncResult<TReturn, TError> {
  return async (...args: TArgs) => {
    try {
      const data = await fn(...args)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error as TError }
    }
  }
}

// ============================================================================
// REACT COMPONENT TYPE UTILITIES
// ============================================================================

/**
 * Type-safe component props with children
 */
export interface ComponentProps {
  className?: string
  children?: ReactNode
}

/**
 * Type-safe event handler props
 */
export interface EventHandlerProps<T = unknown> {
  onClick?: (event: MouseEvent, data?: T) => void
  onKeyDown?: (event: KeyboardEvent, data?: T) => void
  onChange?: (value: T) => void
}

/**
 * Accessibility props with type safety
 */
export interface A11yProps {
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-disabled'?: boolean
  role?: string
  tabIndex?: number
}

/**
 * Complete component props interface
 */
export interface TypeSafeComponentProps<T = unknown> 
  extends ComponentProps, EventHandlerProps<T>, A11yProps {
  id?: string
  'data-testid'?: string
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Type-safe object keys
 */
export function getTypedKeys<T extends Record<string, unknown>>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>
}

/**
 * Type-safe object entries
 */
export function getTypedEntries<T extends Record<string, unknown>>(
  obj: T
): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

/**
 * Type-safe deep partial for configuration objects
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/**
 * Type-safe object merge utility
 */
export function mergeTypedObjects<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target }
  
  for (const [key, value] of getTypedEntries(source)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = mergeTypedObjects(result[key] as Record<string, unknown>, value as any) as T[keyof T]
      } else {
        result[key] = value as T[keyof T]
      }
    }
  }
  
  return result
}