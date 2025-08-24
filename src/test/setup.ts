import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { tauriHandlers, resetMockDatabase } from './mocks/handlers'
import { resetStoreSpies } from './store-testing'

// Configure React Testing Library for React 19
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 3000
})

// Mock Tauri API with our handlers
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock IntersectionObserver for VirtualList components
beforeEach(async () => {
  // Make all items visible by default in virtual lists
  mockAllIsIntersecting(true)
  
  // Reset mock database for each test
  resetMockDatabase()
  
  // Set up default invoke implementation with handlers
  const tauriCore = await import('@tauri-apps/api/core')
  const mockInvoke = tauriCore.invoke as any
  
  // Only set up if it's a vi.fn (mock function)
  if (mockInvoke && typeof mockInvoke.mockImplementation === 'function') {
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      const handler = tauriHandlers[cmd as keyof typeof tauriHandlers]
      if (!handler) {
        throw new Error(`Unknown Tauri command: ${cmd}`)
      }
      return handler(args || {})
    })
  }
})

// SINGLE cleanup mechanism after each test
afterEach(() => {
  // React Testing Library cleanup ONLY
  cleanup()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Reset timers
  vi.useRealTimers()
  
  // Reset mock database
  resetMockDatabase()
  
  // Reset store spies (restores original methods)
  resetStoreSpies()
  
  // Simple, complete store reset - no preservation
  useScratchPadStore.setState({
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
    // Functions will be automatically restored by Zustand
  })
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