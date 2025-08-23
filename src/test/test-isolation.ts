import { vi } from 'vitest'
import { act } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'

/**
 * Complete initial state matching the store definition
 * This ensures all properties are reset to their initial values
 */
export const INITIAL_STORE_STATE = {
  // Core state
  notes: [],
  activeNoteId: null,
  currentView: 'note' as const,
  isCommandPaletteOpen: false,
  isLoading: false,
  error: null,

  // UI state
  expandedFolders: new Set(['recent', 'all-notes']),
  selectedSearchIndex: 0,
  searchQuery: '',

  // Advanced search state
  searchResults: [],
  searchTotalCount: 0,
  currentSearchPage: 0,
  searchPageSize: 20,
  hasMoreSearchResults: false,
  searchQueryTime: 0,
  lastQueryComplexity: null,
  recentSearches: [],
  searchHistory: [],

  // Performance state
  notesCount: 0,
  hasMoreNotes: false,
  isLoadingMore: false,
}

// Store mocks separately to prevent loss
let preservedMocks: Record<string, any> = {}

/**
 * Reset all stores to their initial state
 * This ensures complete test isolation
 */
export function resetAllStores() {
  // Get current state to preserve mock functions if they exist
  const currentState = useScratchPadStore.getState()
  
  // Create a new state with initial values but preserve mock functions
  const resetState = { ...INITIAL_STORE_STATE }
  
  // Preserve mock functions from current state if they exist
  Object.keys(currentState).forEach(key => {
    const value = currentState[key as keyof typeof currentState]
    if (typeof value === 'function' && vi.isMockFunction(value)) {
      // Preserve the mock function but clear its state
      vi.mocked(value).mockClear()
      ;(resetState as any)[key] = value
    }
  })
  
  // Reset Zustand store with preserved mocks
  useScratchPadStore.setState(resetState)
}

/**
 * Setup test isolation with mock preservation
 * Stores mocks separately to prevent loss during component mount
 */
export async function setupTestIsolationWithMocks(mocks?: any) {
  // Clear everything first
  vi.clearAllMocks()
  vi.clearAllTimers()
  
  // Get clean initial state
  const { getInitialState } = useScratchPadStore
  const initialState = getInitialState()
  
  // Reset to initial state first
  useScratchPadStore.setState(initialState)
  
  // Apply mocks if provided
  if (mocks) {
    preservedMocks = mocks
    await act(async () => {
      useScratchPadStore.setState(mocks)
    })
  }
  
  // Ensure mocks are set
  await new Promise(resolve => setTimeout(resolve, 10))
}

/**
 * Enhanced teardown with explicit cleanup
 */
export function teardownTestIsolationEnhanced() {
  // Clear timers with explicit cleanup
  if (vi.isFakeTimers()) {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
  
  // Clear mocks
  vi.clearAllMocks()
  preservedMocks = {}
  
  // Clean DOM
  document.body.innerHTML = ''
  document.getElementById('test-root')?.remove()
}

/**
 * Complete test cleanup utility
 * Clears mocks, timers, and DOM state
 */
export function cleanupTest() {
  // Clear all mocks
  vi.clearAllMocks()
  
  // Clear all timers if fake timers are being used
  if (vi.isFakeTimers()) {
    vi.clearAllTimers()
  }
  
  // Clean up the DOM completely
  document.body.innerHTML = ''
  
  // Reset any global test state
  if (window.localStorage) {
    window.localStorage.clear()
  }
  if (window.sessionStorage) {
    window.sessionStorage.clear()
  }
}

/**
 * Standard beforeEach hook for test isolation
 * Use this in all test files for consistent isolation
 */
export async function setupTestIsolation() {
  // Clear any existing mocks first (before resetting stores)
  vi.clearAllMocks()
  
  // Reset stores
  resetAllStores()
  
  // Wait for any pending state updates to settle
  await new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Standard afterEach hook for test cleanup
 * Use this in all test files for consistent cleanup
 */
export function teardownTestIsolation() {
  cleanupTest()
}