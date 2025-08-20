/**
 * Migration Examples for TypeScript Safety Improvements
 * Concrete before/after examples for each identified issue
 */

// =============================================================================
// 1. ANALYTICS EVENT TYPE SAFETY - Replace data: any
// =============================================================================

// ❌ BEFORE: Unsafe analytics event with any
interface OldAnalyticsEvent {
  type: 'search_start' | 'search_complete' | 'cache_hit' | 'cache_miss' | 'alert_triggered' | 'optimization_applied'
  timestamp: number
  data: any  // ❌ Type safety lost
  source: 'user' | 'system' | 'automated'
}

// ✅ AFTER: Type-safe discriminated union
import { AnalyticsEvent, createAnalyticsEvent } from './analytics-events'

// Usage examples:
const oldWay = {
  type: 'search_start',
  timestamp: Date.now(),
  data: { query: 'test', searchType: 'simple' }, // ❌ No type checking
  source: 'user'
} as any

const newWay = createAnalyticsEvent.searchStart('test', 'simple', {
  context: { triggeredBy: 'keyboard' }
}) // ✅ Full type safety and IntelliSense

// =============================================================================
// 2. STORE SELECTOR TYPE SAFETY - Replace state: any
// =============================================================================

// ❌ BEFORE: Unsafe selectors
const oldNoteSelector = (noteId: number) => (state: any) => ({
  note: state.getNoteById(noteId),
  isActive: state.activeNoteId === noteId,
  hasOptimisticUpdates: state.optimisticUpdates.has(noteId)
})

const oldSearchSelector = (index: number) => (state: any) => ({
  result: state.searchResults[index],
  isSelected: state.selectedSearchIndex === index,
  totalResults: state.searchResults.length
})

// ✅ AFTER: Type-safe selectors
import { createNoteSelector, createSearchResultSelector } from './store'

const newNoteSelector = createNoteSelector(123) // ✅ Full type safety
const newSearchSelector = createSearchResultSelector(0) // ✅ Full type safety

// Usage in components:
import { useScratchPadStore } from '../lib/store'

function MyComponent() {
  // ❌ Old way - no type safety
  const oldData = useScratchPadStore((state: any) => ({
    note: state.getNoteById(123),
    isActive: state.activeNoteId === 123
  }))

  // ✅ New way - full type safety
  const newData = useScratchPadStore(createNoteSelector(123))
  // newData is fully typed: { note: Note | undefined, isActive: boolean, ... }
}

// =============================================================================
// 3. SETTINGS PARSING TYPE SAFETY - Replace return: any
// =============================================================================

// ❌ BEFORE: Unsafe settings parsing
const oldParseSettingValue = (key: keyof Settings, value: string): any => {
  switch (key) {
    case 'window_width':
      return parseInt(value, 10) // ❌ Could return NaN, no type safety
    case 'fuzzy_search_threshold':
      return parseFloat(value)   // ❌ Could return NaN, no type safety
    default:
      return value // ❌ Generic any return
  }
}

// ✅ AFTER: Type-safe settings parsing
import { parseSettingValue, validateSettingValue } from './store'

// Usage examples:
const width = parseSettingValue('window_width', '800') // ✅ Returns number
const theme = parseSettingValue('theme', 'dark')       // ✅ Returns 'light' | 'dark' | 'system'
const format = parseSettingValue('default_note_format', 'markdown') // ✅ Returns 'plaintext' | 'markdown'

// With validation:
const validatedWidth = validateSettingValue('window_width', 1920)
if (validatedWidth) {
  // ✅ TypeScript knows this is ValidatedSettingValue<'window_width'>
  console.log(`Valid width: ${validatedWidth}`)
}

// =============================================================================
// 4. PERFORMANCE MONITORING TYPE SAFETY - Replace (performance as any).memory
// =============================================================================

// ❌ BEFORE: Unsafe browser API access
function oldGetMemoryUsage() {
  if (typeof (performance as any).memory !== 'undefined') {
    const memoryInfo = (performance as any).memory
    return {
      used: memoryInfo.usedJSHeapSize,     // ❌ No type safety
      total: memoryInfo.totalJSHeapSize,   // ❌ Could be undefined
      limit: memoryInfo.jsHeapSizeLimit    // ❌ Could throw errors
    }
  }
  return null
}

// ✅ AFTER: Type-safe browser API access
import { getMemoryUsage, hasMemoryAPI, checkMemoryThresholds } from './browser'

function newGetMemoryUsage() {
  const usage = getMemoryUsage() // ✅ Returns MemoryUsage | null
  if (usage) {
    console.log(`Memory: ${usage.percentage.toFixed(1)}%`) // ✅ Full type safety
    
    // Additional features with type safety:
    const alert = checkMemoryThresholds({ warning: 80, critical: 95 })
    if (alert) {
      console.warn(alert.message) // ✅ Typed alert object
    }
  }
}

// Type guard usage:
if (hasMemoryAPI(performance)) {
  // ✅ TypeScript knows performance.memory exists here
  const { memory } = performance
  console.log(`Heap size: ${memory.usedJSHeapSize}`)
}

// =============================================================================
// 5. FOCUS MANAGEMENT GENERICS - Replace any[] and onSelect: any
// =============================================================================

// ❌ BEFORE: Unsafe focus management
interface OldFocusManagementOptions {
  items: any[]
  isOpen: boolean
  onSelect: (item: any, index: number) => void
}

function oldUseFocusManagement(options: OldFocusManagementOptions) {
  // ❌ No type safety for items or onSelect
  const { items, onSelect } = options
  
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      onSelect(items[0], 0) // ❌ items[0] could be anything
    }
  }
  
  return { handleKeyDown }
}

// ✅ AFTER: Type-safe generic focus management
import { FocusManagementOptions, useFocusManagement } from './utility'

interface SearchResult {
  id: number
  title: string
  content: string
}

function MySearchComponent() {
  const searchResults: SearchResult[] = [
    { id: 1, title: 'Note 1', content: 'Content 1' },
    { id: 2, title: 'Note 2', content: 'Content 2' }
  ]
  
  // ✅ Full generic type safety
  const focusManagement = useFocusManagement<SearchResult>({
    items: searchResults,
    isOpen: true,
    onSelect: (item, index) => {
      // ✅ item is typed as SearchResult
      console.log(`Selected: ${item.title} at index ${index}`)
    },
    getItemId: (item) => item.id.toString(), // ✅ item is SearchResult
    isDisabled: (item) => item.content.length === 0 // ✅ Type-safe
  })
  
  return `
    <div>
      {searchResults.map((result, index) => (
        <div
          key={result.id}
          {...focusManagement.getFocusProps(index)}
        >
          {result.title}
        </div>
      ))}
    </div>
  `
}

// =============================================================================
// 6. MIDDLEWARE TYPE SAFETY - Replace middleware any usage
// =============================================================================

// ❌ BEFORE: Unsafe middleware patterns
const oldDevtools = (stateCreator: any, config?: any) => {
  return stateCreator // ❌ No type safety
}

const oldPersistence = {
  partialize: (state: any) => ({ // ❌ Lost state typing
    notes: state.notes,
    settings: state.settings
  }),
  merge: (persistedState: any, currentState: any) => ({ // ❌ No safety
    ...currentState,
    ...persistedState
  })
}

// ✅ AFTER: Type-safe middleware with proper generics
import { ScratchPadStore } from '../lib/store'

// Type-safe persistence configuration
const newPersistence = {
  partialize: (state: ScratchPadStore) => ({ // ✅ Properly typed state
    notes: state.notes,
    settings: state.settings,
    searchHistory: state.searchHistory
  }),
  merge: (
    persistedState: Partial<ScratchPadStore>, 
    currentState: ScratchPadStore
  ): ScratchPadStore => ({ // ✅ Type-safe merge
    ...currentState,
    ...persistedState
  })
}

// Type-safe devtools configuration
const newDevtools = {
  name: 'ScratchPad Store',
  serialize: {
    replacer: (key: string, value: unknown) => {
      // ✅ Type-safe serialization
      if (key === 'optimisticUpdates') {
        return Array.from(value as Set<number>)
      }
      return value
    }
  }
}

// =============================================================================
// 7. ERROR BOUNDARY TYPE SAFETY - Replace error: any
// =============================================================================

// ❌ BEFORE: Generic error handling
interface OldErrorBoundaryState {
  hasError: boolean
  error: any // ❌ Lost error typing
}

// ✅ AFTER: Type-safe error handling
interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorBoundaryStack?: string
}

interface TypedError extends Error {
  errorInfo?: ErrorInfo
  severity?: 'low' | 'medium' | 'high' | 'critical'
  recoverable?: boolean
  timestamp?: number
  userAgent?: string
  url?: string
}

interface NewErrorBoundaryState {
  hasError: boolean
  error: TypedError | null // ✅ Properly typed error
  errorId: string | null
  retryCount: number
}

// Usage in error boundary:
class TypeSafeErrorBoundary extends Component<{}, NewErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): Partial<NewErrorBoundaryState> {
    const typedError: TypedError = {
      ...error,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    return {
      hasError: true,
      error: typedError, // ✅ Type-safe error state
      errorId: crypto.randomUUID()
    }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ Properly typed error reporting
    if (this.state.error) {
      this.state.error.errorInfo = errorInfo
    }
  }
}

// =============================================================================
// 8. COMPLETE MIGRATION CHECKLIST
// =============================================================================

/*
✅ 1. Replace src/types/analytics.ts line 216: data: any
   → Use discriminated union from analytics-events.ts

✅ 2. Update src/lib/store/hooks.ts lines 325, 331: selector (state: any)
   → Use typed selectors from store.ts

✅ 3. Fix src/lib/store/slices/settingsSlice.ts line 236: parseSettingValue return any
   → Use typed parsing from store.ts

✅ 4. Replace src/hooks/usePerformanceMonitor.ts: (performance as any).memory
   → Use browser API types from browser.ts

✅ 5. Update src/hooks/useFocusManagement.ts: items: any[], onSelect: any
   → Use generic types from utility.ts

✅ 6. Fix middleware files: various any usage in devtools, persistence, performance
   → Use proper generic constraints and store types

✅ 7. Update error boundary: error handling with proper typing
   → Use TypedError interface for comprehensive error information

✅ 8. Replace window/performance as any patterns
   → Use extended interfaces and type guards from browser.ts
*/