import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'

// SINGLE Tauri mock setup - ONLY HERE, nowhere else
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Minimal cleanup after each test
afterEach(() => {
  cleanup() // React Testing Library cleanup
  vi.clearAllMocks() // Clear all mocks
  vi.useRealTimers() // Reset timers
  
  // Reset store to initial state
  const initialState = {
    notes: [],
    activeNoteId: null,
    currentView: 'note' as const,
    isCommandPaletteOpen: false,
    isLoading: false,
    error: null,
    expandedFolders: new Set(['recent', 'all-notes']),
    selectedSearchIndex: 0,
    searchQuery: '',
    searchResults: [],
    searchTotalCount: 0,
    currentSearchPage: 0,
    searchPageSize: 20,
    hasMoreSearchResults: false,
    searchQueryTime: 0,
    lastQueryComplexity: null,
    recentSearches: [],
    searchHistory: [],
    notesCount: 0,
    hasMoreNotes: false,
    isLoadingMore: false,
  }
  
  useScratchPadStore.setState(initialState)
})

// Minimal beforeEach setup
beforeEach(() => {
  vi.clearAllMocks()
})

// Essential DOM mocks only
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn().mockReturnValue(true)
})

global.getComputedStyle = vi.fn(() => ({
  getPropertyValue: vi.fn(() => 'auto'),
  pointerEvents: 'auto'
}))

global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))