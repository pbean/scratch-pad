import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, beforeEach } from 'vitest'
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

// Define the initial state constant to match the Zustand store's initial state
const INITIAL_STORE_STATE = {
  // Core state
  notes: [],
  activeNoteId: null,
  currentView: "note" as const,
  isCommandPaletteOpen: false,
  isLoading: false,
  error: null,

  // UI state
  expandedFolders: new Set(["recent", "all-notes"]),
  selectedSearchIndex: 0,
  searchQuery: "",

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

// Capture all original store methods once at module level
let originalStoreMethods: Record<string, any> = {}

beforeAll(() => {
  // Capture all original store methods from current state
  const currentState = useScratchPadStore.getState()
  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === 'function') {
      originalStoreMethods[key] = value
    }
  })
})

// Mock Tauri API
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

/**
 * Smart store reset that preserves vi.fn() mocks while resetting data fields
 * Session 36 Fix: This prevents the common issue where setState(initialState, true) destroys all mocks
 */
export function resetStorePreservingMocks() {
  const currentState = useScratchPadStore.getState()
  
  // Step 1: Identify and preserve all vi.fn() mocks from current state
  const preservedMocks: Record<string, any> = {}
  
  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === 'function') {
      // Check if it's a vi.fn() mock
      if (value && (value._isMockFunction || typeof value.mockClear === 'function')) {
        preservedMocks[key] = value
        // Clear the mock's call history but preserve the mock itself
        if (typeof value.mockClear === 'function') {
          value.mockClear()
        }
      }
    }
  })
  
  // Step 2: Extract data-only fields from initial state
  const dataOnlyFields: Record<string, any> = {}
  Object.entries(INITIAL_STORE_STATE).forEach(([key, value]) => {
    if (typeof value !== 'function') {
      // For Set objects, create new instances to avoid reference sharing
      if (value instanceof Set) {
        dataOnlyFields[key] = new Set(value)
      } else if (Array.isArray(value)) {
        dataOnlyFields[key] = [...value]
      } else {
        dataOnlyFields[key] = value
      }
    }
  })
  
  // Step 3: Create the new state by merging preserved mocks with fresh data
  const newState = {
    ...dataOnlyFields,      // Reset all data fields to initial values
    ...preservedMocks       // Preserve all mocked functions
  }
  
  // Add fallback to originalStoreMethods for any missing functions
  Object.entries(currentState).forEach(([key, currentValue]) => {
    if (typeof currentValue === 'function' && !newState[key]) {
      newState[key] = preservedMocks[key] || originalStoreMethods[key] || currentValue
    }
  })
  
  // Step 4: Apply the smart reset - false = partial update, preserves other functions
  useScratchPadStore.setState(newState, false)
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

// Session 36 Optimized Cleanup
afterEach(async () => {
  // Fix 1: Clear all pending timers BEFORE switching to real timers
  vi.clearAllTimers()
  
  // Phase 1: Stop all timers immediately
  vi.useRealTimers()
  
  // Phase 2: Clear Tauri mock calls
  try {
    const mockInvoke = await getMockInvoke()
    if (mockInvoke && typeof mockInvoke.mockClear === 'function') {
      mockInvoke.mockClear()
    }
  } catch (e) {
    // Mock might not be available in all tests
  }
  
  // Phase 3: Reset mock database state
  resetMockDatabase()
  
  // Phase 4: Reset store spies
  resetStoreSpies()
  
  // Clear any remaining mocked functions
  const currentState = useScratchPadStore.getState()
  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === 'function' && value && typeof value.mockClear === 'function') {
      try {
        value.mockClear()
      } catch (e) {
        // Ignore errors for mocks that can't be cleared
      }
    }
  })
  
  // Phase 5: Smart reset store
  resetStorePreservingMocks()

  // Phase 6: React Testing Library cleanup
  cleanup()
  
  // Phase 7: Clean up DOM artifacts (conservative approach)
  const portalRoot = document.getElementById('radix-portal-root')
  if (portalRoot && portalRoot.children.length > 0) {
    portalRoot.innerHTML = ''
  }
  
  // Clean specific portal containers
  document.querySelectorAll('[data-radix-portal]').forEach(el => {
    if (!el.closest('[data-testid]')) {
      el.remove()
    }
  })
  
  // Clean up test artifacts
  document.querySelectorAll('[data-testid="dialog-overlay"], .palette-backdrop').forEach(el => {
    el.remove()
  })
  
  // Conservative root cleanup
  const root = document.getElementById('root')
  if (root) {
    const hasTestContent = root.querySelector('[data-testid], [role="dialog"], .palette-backdrop')
    if (hasTestContent) {
      root.innerHTML = ''
    }
  }
})

// Essential DOM mocks
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn().mockReturnValue(true)
})

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
  
  if (!element) return createDefaultStyle()
  return createDefaultStyle()
})

global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))

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

// Mock performance components to prevent complex dependencies
vi.mock('../components/performance/PerformanceDashboard', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'performance-dashboard', ...props }, 'Performance Dashboard')
}))

vi.mock('../components/performance/PerformanceAlertManager', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'performance-alert-manager', ...props }, 'Performance Alert Manager')
}))

vi.mock('../components/performance/OptimizationRecommendations', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'optimization-recommendations', ...props }, 'Optimization Recommendations')
}))

// Mock Radix UI components for simplicity
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