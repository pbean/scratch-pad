import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanup, configure, act } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { tauriHandlers, resetMockDatabase } from './mocks/handlers'
import { resetStoreSpies } from './store-testing'

// Configure React Testing Library for React 19
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 3000
})

// Capture all original store methods once at module level
let originalStoreMethods: Record<string, any> = {}

beforeAll(() => {
  // Capture all original store methods from initial state
  const initialState = useScratchPadStore.getInitialState()
  Object.entries(initialState).forEach(([key, value]) => {
    if (typeof value === 'function') {
      originalStoreMethods[key] = value
    }
  })
  
  // Also capture from current state if any additional methods exist
  const currentState = useScratchPadStore.getState()
  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === 'function' && !originalStoreMethods[key]) {
      originalStoreMethods[key] = value
    }
  })
})

// Mock Tauri API - this hoists to the top and creates the mock inline
vi.mock('@tauri-apps/api/core', async () => {
  const { vi } = await import('vitest')
  const { tauriHandlers } = await import('./mocks/handlers')
  
  const mockInvoke = vi.fn(async (cmd: string, args?: any) => {
    const handler = tauriHandlers[cmd as keyof typeof tauriHandlers]
    if (!handler) {
      throw new Error(`Unknown Tauri command: ${cmd}`)
    }
    return handler(args || {})
  })
  
  return {
    invoke: mockInvoke
  }
})

// Export the mock for tests that need to spy on it
export const getMockInvoke = async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke as ReturnType<typeof vi.fn>
}

// Mock IntersectionObserver for VirtualList components
beforeEach(async () => {
  // Make all items visible by default in virtual lists
  mockAllIsIntersecting(true)
  
  // Reset mock database for each test
  resetMockDatabase()
  
  // Clear mock calls but keep implementation
  try {
    const mockInvoke = await getMockInvoke()
    if (mockInvoke && typeof mockInvoke.mockClear === 'function') {
      mockInvoke.mockClear()
    }
  } catch (e) {
    // Mock might not be available yet
  }
})

// SINGLE cleanup mechanism after each test
afterEach(async () => {
  // 1. React Testing Library cleanup
  cleanup()
  
  // 2. Wait for all React updates to complete
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  
  // 3. Force remove any lingering portal elements
  document.querySelectorAll('[data-radix-portal]').forEach(el => el.remove())
  document.querySelectorAll('.palette-backdrop').forEach(el => el.remove())
  document.querySelectorAll('[role="dialog"]').forEach(el => el.remove())
  
  // 4. Clean up body but don't enforce strict checks
  try {
    const bodyChildren = Array.from(document.body.children)
    const nonRootElements = bodyChildren.filter(el => el.id !== 'root')
    nonRootElements.forEach(el => el.remove())
  } catch (e) {
    // Ignore cleanup errors
  }
  
  // Clear mock calls but preserve implementations
  try {
    const mockInvoke = await getMockInvoke()
    if (mockInvoke && typeof mockInvoke.mockClear === 'function') {
      mockInvoke.mockClear()
    }
  } catch (e) {
    // Mock might not be available in all tests
  }
  
  // Reset timers
  vi.useRealTimers()
  
  // Reset mock database
  resetMockDatabase()
  
  // Reset store spies (restores original methods)
  resetStoreSpies()
  
  // Clear spy calls if they exist on current store methods
  const currentStore = useScratchPadStore.getState()
  Object.values(currentStore).forEach(value => {
    if (typeof value === 'function' && value.mockClear) {
      value.mockClear()
    }
  })
  
  // Only reset data fields, not methods
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
    isLoadingMore: false
  }, false) // false = partial update, preserves existing functions
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