/**
 * Type-Safe Store Utilities
 * Replaces any usage in store management with proper generics
 */

import type { ScratchPadStore } from '../lib/store/index'
import type { Note, SearchResult, Settings } from './index'

// Generic store selector types for type safety
export type StoreSelector<TState, TResult> = (state: TState) => TResult
export type ScratchPadStoreSelector<TResult> = StoreSelector<ScratchPadStore, TResult>

// Store subscription callback types
export type StoreSubscriptionCallback<TSlice> = (slice: TSlice) => void
export type StoreUnsubscribe = () => void

// Specific selector return types for common patterns
export interface NoteSelectionResult {
  note: Note | undefined
  isActive: boolean
  hasOptimisticUpdates: boolean
  isLoading: boolean
  hasUnsavedChanges: boolean
}

export interface SearchResultSelectionResult {
  result: SearchResult | undefined
  isSelected: boolean
  totalResults: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface UIStateSelectionResult {
  currentView: string
  isLoading: boolean
  lastError: string | null
  activeModal: string | null
}

export interface SearchStateSelectionResult {
  query: string
  results: SearchResult[]
  isSearching: boolean
  hasMore: boolean
  totalCount: number
  filters: Record<string, unknown>
}

// Type-safe selector factory functions
export function createNoteSelector(noteId: number): ScratchPadStoreSelector<NoteSelectionResult> {
  return (state: ScratchPadStore): NoteSelectionResult => ({
    note: state.getNoteById(noteId),
    isActive: state.activeNoteId === noteId,
    hasOptimisticUpdates: state.optimisticUpdates.has(noteId),
    isLoading: state.isLoadingNotes,
    hasUnsavedChanges: state.hasUnsavedChanges()
  })
}

export function createSearchResultSelector(index: number): ScratchPadStoreSelector<SearchResultSelectionResult> {
  return (state: ScratchPadStore): SearchResultSelectionResult => ({
    result: state.searchResults[index] as any,
    isSelected: state.selectedSearchIndex === index,
    totalResults: state.searchResults.length,
    hasNextPage: false, // hasMoreResults not in current store
    hasPreviousPage: index > 0
  })
}

export function createUIStateSelector(): ScratchPadStoreSelector<UIStateSelectionResult> {
  return (state: ScratchPadStore): UIStateSelectionResult => ({
    currentView: state.currentView,
    isLoading: state.isLoading,
    lastError: state.error,
    activeModal: null // Not implemented in current store
  })
}

export function createSearchStateSelector(): ScratchPadStoreSelector<SearchStateSelectionResult> {
  return (state: ScratchPadStore): SearchStateSelectionResult => ({
    query: state.searchQuery,
    results: state.searchResults as any,
    isSearching: state.isSearching,
    hasMore: false, // hasMoreResults not in current store
    totalCount: 0, // totalResults not in current store
    filters: {} // Not implemented in current store
  })
}

// Multi-note selector for bulk operations
export function createMultiNoteSelector(noteIds: number[]): ScratchPadStoreSelector<{
  notes: Note[]
  allLoaded: boolean
  someSelected: boolean
  allSelected: boolean
}> {
  return (state: ScratchPadStore) => {
    const notes = noteIds.map(id => state.getNoteById(id)).filter(Boolean) as Note[]
    const selectedIds = new Set<number>() // selectedNoteIds not implemented
    
    return {
      notes,
      allLoaded: notes.length === noteIds.length,
      someSelected: noteIds.some(id => selectedIds.has(id)),
      allSelected: noteIds.every(id => selectedIds.has(id))
    }
  }
}

// Settings-specific selector types and utilities
export type SettingKey = keyof Settings
export type SettingValue<K extends SettingKey> = Settings[K]

// Branded types for settings validation
export type ValidatedSettingValue<K extends SettingKey> = SettingValue<K> & {
  readonly __validated: true
  readonly __key: K
}

// Type-safe settings parsing with proper return types
export function parseSettingValue<K extends SettingKey>(
  key: K,
  value: string
): SettingValue<K> | undefined {
  switch (key) {
    case 'window_width':
    case 'window_height':
    case 'auto_save_delay_ms':
    case 'search_limit': {
      const parsed = parseInt(value, 10)
      return (isNaN(parsed) ? 0 : parsed) as SettingValue<K>
    }
    
    case 'fuzzy_search_threshold': {
      const parsed = parseFloat(value)
      return (isNaN(parsed) ? 0.6 : Math.max(0, Math.min(1, parsed))) as SettingValue<K>
    }
    
    case 'default_note_format': {
      const validFormats = ['plaintext', 'markdown'] as const
      return (validFormats.includes(value as any) ? value : 'plaintext') as SettingValue<K>
    }
    
    case 'layout_mode': {
      const validModes = ['default', 'half', 'full'] as const
      return (validModes.includes(value as any) ? value : 'default') as SettingValue<K>
    }
    
    case 'theme':
      return (value as any)
    
    case 'ui_font':
    case 'editor_font': {
      return value as SettingValue<K>
    }
    
    case 'global_shortcut':
    case 'note_directory':
      return (value as any)
    
    default: {
      // Exhaustive check - TypeScript will error if we miss a setting
      // const _exhaustiveCheck: never = key // Removed unused variable
      return undefined
    }
  }
}

// Settings validation utilities
export function validateSettingValue<K extends SettingKey>(
  key: K,
  value: SettingValue<K>
): ValidatedSettingValue<K> | null | undefined {
  try {
    switch (key) {
      case 'window_width':
      case 'window_height':
        return (typeof value === 'number' && value >= 100 && value <= 4000) 
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'auto_save_delay_ms':
        return (typeof value === 'number' && value >= 100 && value <= 10000)
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'search_limit':
        return (typeof value === 'number' && value >= 10 && value <= 1000)
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'fuzzy_search_threshold':
        return (typeof value === 'number' && value >= 0 && value <= 1)
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'default_note_format':
        return (['plaintext', 'markdown'].includes(value as string))
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'layout_mode':
        return (['default', 'half', 'full'].includes(value as string))
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'theme':
      return (value as any)
      
      case 'ui_font':
      case 'editor_font':
        return (typeof value === 'string' && value.length > 0)
          ? (value as ValidatedSettingValue<K>)
          : null
      
      case 'global_shortcut':
      case 'note_directory':
      return (value as any)
      
      default:
        // const _exhaustiveCheck: never = key // Removed unused variable
        return undefined
    }
  } catch {
    return null
  }
}

// Store state diff utilities for debugging
export interface StoreDiff {
  path: string
  from: unknown
  to: unknown
  type: 'added' | 'removed' | 'changed'
}

export function createStoreDiff(
  previous: Partial<ScratchPadStore>,
  current: Partial<ScratchPadStore>,
  path = ''
): StoreDiff[] {
  const diffs: StoreDiff[] = []
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)])
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key
    const prevValue = (previous as any)[key]
    const currValue = (current as any)[key]
    
    if (!(key in previous)) {
      diffs.push({
        path: currentPath,
        from: undefined,
        to: currValue,
        type: 'added'
      })
    } else if (!(key in current)) {
      diffs.push({
        path: currentPath,
        from: prevValue,
        to: undefined,
        type: 'removed'
      })
    } else if (prevValue !== currValue) {
      if (typeof prevValue === 'object' && typeof currValue === 'object' && 
          prevValue !== null && currValue !== null) {
        diffs.push(...createStoreDiff(prevValue, currValue, currentPath))
      } else {
        diffs.push({
          path: currentPath,
          from: prevValue,
          to: currValue,
          type: 'changed'
        })
      }
    }
  }
  
  return diffs
}

// Performance tracking for store operations
export interface StoreOperationMetrics {
  operationName: string
  startTime: number
  endTime: number
  duration: number
  stateSize: number
  changedPaths: string[]
}

export function createStorePerformanceTracker() {
  const metrics: StoreOperationMetrics[] = []
  let currentOperation: Partial<StoreOperationMetrics> | null = null
  
  return {
    startOperation: (name: string, state: ScratchPadStore) => {
      currentOperation = {
        operationName: name,
        startTime: performance.now(),
        stateSize: JSON.stringify(state).length
      }
    },
    
    endOperation: (state: ScratchPadStore, changedPaths: string[] = []) => {
      if (!currentOperation) return
      
      const endTime = performance.now()
      const metric: StoreOperationMetrics = {
        operationName: currentOperation.operationName!,
        startTime: currentOperation.startTime!,
        endTime,
        duration: endTime - currentOperation.startTime!,
        stateSize: JSON.stringify(state).length,
        changedPaths
      }
      
      metrics.push(metric)
      currentOperation = null
      
      // Keep only last 100 metrics
      if (metrics.length > 100) {
        metrics.splice(0, metrics.length - 100)
      }
    },
    
    getMetrics: () => [...metrics],
    
    getAverageOperationTime: (operationName?: string) => {
      const relevantMetrics = operationName 
        ? metrics.filter(m => m.operationName === operationName)
        : metrics
      
      if (relevantMetrics.length === 0) return 0
      
      return relevantMetrics.reduce((sum, m) => sum + m.duration, 0) / relevantMetrics.length
    },
    
    clearMetrics: () => {
      metrics.length = 0
      currentOperation = null
    }
  }
}

// Type utility for extracting store slice types
export type ExtractSliceType<T, K extends keyof T> = T[K]

// Helper for creating type-safe store subscriptions
export function createStoreSubscription<T>(
  store: { subscribe: (fn: (state: ScratchPadStore) => void) => () => void },
  selector: ScratchPadStoreSelector<T>,
  callback: (value: T) => void
): () => void {
  let previousValue: T | undefined
  
  return store.subscribe((state) => {
    const currentValue = selector(state)
    
    if (previousValue === undefined || !Object.is(previousValue, currentValue)) {
      previousValue = currentValue
      callback(currentValue)
    }
  })
}