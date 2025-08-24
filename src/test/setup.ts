import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { tauriHandlers, resetMockDatabase } from './mocks/handlers'

// Configure React Testing Library for React 19
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 3000
})

// Mock Tauri API with our handlers
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args?: any) => {
    const handler = tauriHandlers[cmd as keyof typeof tauriHandlers]
    if (!handler) {
      throw new Error(`Unknown Tauri command: ${cmd}`)
    }
    return handler(args || {})
  })
}))

// Store the original functions from the store
let originalStoreFunctions: Record<string, any> = {}

// Mock IntersectionObserver for VirtualList components
beforeEach(() => {
  // Make all items visible by default in virtual lists
  mockAllIsIntersecting(true)
  
  // Reset mock database for each test
  resetMockDatabase()
  
  // Capture original store functions on first test
  if (Object.keys(originalStoreFunctions).length === 0) {
    const state = useScratchPadStore.getState()
    Object.keys(state).forEach(key => {
      const value = state[key as keyof typeof state]
      if (typeof value === 'function') {
        originalStoreFunctions[key] = value
      }
    })
  }
})

// SINGLE cleanup mechanism after each test
afterEach(() => {
  // React Testing Library cleanup ONLY
  cleanup()
  
  // Clear all mocks (but don't reset implementations)
  vi.clearAllMocks()
  
  // Reset timers
  vi.useRealTimers()
  
  // Reset mock database
  resetMockDatabase()
  
  // Smart store reset - preserve functions, reset data only
  const currentState = useScratchPadStore.getState()
  const resetState: any = {
    // Data properties only - reset these to initial values
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
  
  // Intelligently preserve functions
  Object.keys(currentState).forEach(key => {
    const value = currentState[key as keyof typeof currentState]
    if (typeof value === 'function') {
      // Check if this is a mock function (has mockImplementation property)
      if ('mockImplementation' in value || 'mockResolvedValue' in value) {
        // Keep the mock for tests that explicitly set it
        resetState[key] = value
      } else if (originalStoreFunctions[key]) {
        // Restore original function if we have it and it's not mocked
        resetState[key] = originalStoreFunctions[key]
      } else {
        // Keep current function as fallback
        resetState[key] = value
      }
    }
  })
  
  useScratchPadStore.setState(resetState)
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

// Enhanced Radix UI component mocks for better test compatibility
vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'tabs-root', ...props }, children),
  List: ({ children, ...props }: any) => React.createElement('div', { role: 'tablist', ...props }, children),
  Trigger: ({ children, ...props }: any) => React.createElement('button', { role: 'tab', ...props }, children),
  Content: ({ children, ...props }: any) => React.createElement('div', { role: 'tabpanel', ...props }, children),
}))

vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: any) => open ? children : null,
  Portal: ({ children }: any) => children,
  Overlay: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-overlay', ...props }, children),
  Content: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'dialog-content', ...props }, children),
  Title: ({ children, ...props }: any) => React.createElement('h2', props, children),
  Description: ({ children, ...props }: any) => React.createElement('p', props, children),
  Close: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'dialog-close', ...props }, children),
}))

vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: any) => children,
  Trigger: ({ children, ...props }: any) => React.createElement('button', { 'data-testid': 'popover-trigger', ...props }, children),
  Portal: ({ children }: any) => children,
  Content: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'popover-content', ...props }, children),
}))