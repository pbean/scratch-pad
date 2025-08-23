import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'

// Configure React Testing Library for React 19
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 3000
})

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

// Enhanced getComputedStyle for better element handling
global.getComputedStyle = vi.fn((element: any) => {
  const createDefaultStyle = () => ({
    getPropertyValue: vi.fn((prop: string) => {
      if (prop === 'pointer-events' || prop === 'pointerEvents') return 'auto'
      if (prop === 'display') return 'block'
      return ''
    }),
    pointerEvents: 'auto',
    display: 'block'
  })
  
  // Handle null/undefined elements safely
  if (!element) return createDefaultStyle()
  
  // Handle all element types
  return createDefaultStyle()
})

global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))

// Mock other essential APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

