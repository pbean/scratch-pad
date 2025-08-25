import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { useScratchPadStore } from '../lib/store'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { tauriHandlers, resetMockDatabase } from './mocks/handlers'
import { resetStoreSpies } from './store-testing'

// Configure React Testing Library for React 19 - enhanced for better test compatibility
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 3000,
  // React 19: Let React handle act() automatically, don't wrap user events
  asyncWrapper: async (cb) => {
    return await cb()
  }
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

/**
 * Smart store reset that preserves vi.fn() mocks while resetting data fields
 * This prevents the common issue where setState(initialState, true) destroys all mocks
 * 
 * FIX 2: Enhanced with fallback to originalStoreMethods for complete preservation
 */
export function resetStorePreservingMocks() {
  const currentState = useScratchPadStore.getState()
  
  // Step 1: Identify and preserve all vi.fn() mocks from current state
  const preservedMocks: Record<string, any> = {}
  const mockCallsCleared: string[] = []
  
  Object.entries(currentState).forEach(([key, value]) => {
    if (typeof value === 'function') {
      // Check if it's a vi.fn() mock (has _isMockFunction or mock methods)
      if (value && (value._isMockFunction || typeof value.mockClear === 'function')) {
        preservedMocks[key] = value
        // Clear the mock's call history but preserve the mock itself
        if (typeof value.mockClear === 'function') {
          value.mockClear()
          mockCallsCleared.push(key)
        }
      }
      // If it's not a mock, we'll let it be reset to initial state
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
  // FIX 2: Enhanced fallback ensures all functions are preserved
  const newState = {
    ...dataOnlyFields,      // Reset all data fields to initial values
    ...preservedMocks       // Preserve all mocked functions
  }
  
  // FIX 2: Add fallback to originalStoreMethods for any missing functions
  Object.entries(currentState).forEach(([key, currentValue]) => {
    if (typeof currentValue === 'function' && !newState[key]) {
      // Use preserved mock, or fall back to original method
      newState[key] = preservedMocks[key] || originalStoreMethods[key] || currentValue
    }
  })
  
  // Step 4: Apply the smart reset - false = partial update, preserves other functions
  useScratchPadStore.setState(newState, false)
  
  // Log for debugging if needed (can be removed in production)
  if (process.env.NODE_ENV === 'test' && mockCallsCleared.length > 0) {
    // console.log(`Smart reset: preserved ${Object.keys(preservedMocks).length} mocks, cleared calls for: ${mockCallsCleared.join(', ')}`)
  }
}

/**
 * Validation function to ensure mocks persist after reset
 * Returns true if all expected mocks are still vi.fn() instances
 */
export function validateMocksPreserved(expectedMocks: string[] = []): boolean {
  const currentState = useScratchPadStore.getState()
  
  for (const mockName of expectedMocks) {
    const method = (currentState as any)[mockName]
    if (!method || typeof method !== 'function') {
      console.warn(`Mock validation failed: ${mockName} is not a function`)
      return false
    }
    if (!method._isMockFunction && typeof method.mockClear !== 'function') {
      console.warn(`Mock validation failed: ${mockName} is not a vi.fn() mock`)
      return false
    }
  }
  
  return true
}

/**
 * Helper to get the initial state for testing
 */
export function getInitialStoreState() {
  return structuredClone(INITIAL_STORE_STATE)
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

// REACT 19 OPTIMIZED CLEANUP - prevents act() overlapping warnings
afterEach(async () => {
  // FIX 1: Clear all pending timers BEFORE switching to real timers
  // This prevents uncaught exceptions from timer-based React updates
  vi.clearAllTimers()
  
  // Phase 1: Stop all timers immediately to prevent timer-based React updates
  vi.useRealTimers()
  
  // Phase 2: Clear Tauri mock calls early to prevent late IPC operations
  try {
    const mockInvoke = await getMockInvoke()
    if (mockInvoke && typeof mockInvoke.mockClear === 'function') {
      mockInvoke.mockClear()
    }
  } catch (e) {
    // Mock might not be available in all tests
  }
  
  // Phase 3: Reset mock database state before any React cleanup
  resetMockDatabase()
  
  // Phase 4: Reset store spies (restores original methods) - CRITICAL: before smart reset
  resetStoreSpies()
  
  // FIX 3: Add comprehensive mock state isolation after store spy reset
  // This ensures any mocked functions have their state properly cleared
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
  
  // Phase 5: SMART RESET - preserves mocks while resetting data (no React updates)
  resetStorePreservingMocks()
  
  // Phase 6: Let React Testing Library handle React cleanup with automatic act()
  // This is React 19 compatible - RTL wraps cleanup in act() automatically
  cleanup()
  
  // Phase 7: Manual DOM cleanup after React is fully cleaned up
  // Use synchronous operations only - no act() wrapper needed
  
  // Clean portal containers
  const portalRoot = document.getElementById('radix-portal-root')
  if (portalRoot) {
    portalRoot.innerHTML = ''
  }
  
  // Clean specific portal containers
  document.querySelectorAll('[data-radix-portal]').forEach(el => {
    el.remove()
  })
  
  // Clean up dialogs and overlays
  document.querySelectorAll('[role="dialog"], [data-testid="dialog-overlay"], .palette-backdrop').forEach(el => {
    el.remove()
  })
  
  // Clean up root container
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = ''
  }
  
  // FIX 4: Enhanced Portal Cleanup with synchronous retry logic
  // Use synchronous retry instead of async waitFor to prevent timing issues
  let retryCount = 0
  const maxRetries = 10
  
  while (retryCount < maxRetries) {
    try {
      const bodyChildren = Array.from(document.body.children)
      const nonRootElements = bodyChildren.filter(el => 
        el.id !== 'root' && 
        !el.hasAttribute('data-react-19-internal') && // Allow React 19 internal elements
        !el.matches('script, style, link, meta') // Don't remove essential DOM elements
      )
      
      if (nonRootElements.length === 0) {
        // Success: only root element remains
        break
      }
      
      // Remove non-essential elements
      nonRootElements.forEach(el => {
        try {
          el.remove()
        } catch (e) {
          // Ignore removal errors for React-managed elements
        }
      })
      
      retryCount++
      
      // If we've tried multiple times and still have elements, it's probably safe to continue
      if (retryCount >= maxRetries) {
        console.debug(`Portal cleanup completed after ${retryCount} attempts, ${nonRootElements.length} elements remaining`)
        break
      }
      
    } catch (e) {
      // Ignore cleanup errors - React 19 is more forgiving
      break
    }
  }
  
  // Note: No manual act() wrapper - React 19 + RTL handle this automatically
  // The old problematic pattern was:
  // await act(async () => { /* cleanup operations */ }) ❌ This caused overlapping!
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

// REACT 19 COMPATIBLE Radix UI component mocks
// These avoid manual act() calls and work with React 19's automatic batching
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

/*
 * REACT 19 TESTING INFRASTRUCTURE FIXES APPLIED:
 * 
 * FIX 1: ✅ Timer Mock Cleanup (HIGHEST PRIORITY)
 *   - Added vi.clearAllTimers() BEFORE vi.useRealTimers() at line 208
 *   - Prevents uncaught exceptions from pending timer-based React updates
 * 
 * FIX 2: ✅ Complete Store Preservation  
 *   - Fixed getInitialState() issue by creating INITIAL_STORE_STATE constant
 *   - Enhanced resetStorePreservingMocks with proper initial state handling
 *   - Ensures all functions preserved: preservedMocks || originalStoreMethods || currentValue
 *   - Added proper handling of Set objects and arrays to prevent reference sharing
 *   - EXPORTED resetStorePreservingMocks for manual testing/validation
 * 
 * FIX 3: ✅ Mock State Isolation
 *   - Added comprehensive mock clearing after resetStoreSpies() at line 229
 *   - Iterates through current state and calls mockClear() on any vi.fn() instances
 *   - Prevents mock state bleeding between tests
 * 
 * FIX 4: ✅ Enhanced Portal Cleanup (SAFER VERSION)
 *   - Replaced async waitFor with synchronous retry logic after line 274
 *   - Maximum 10 retries with immediate removal of non-root elements
 *   - Ensures clean DOM state without timing-related issues
 * 
 * MIGRATION NOTES FOR TESTS:
 * - Remove manual act() calls from tests - React 19 + RTL handle this
 * - Use user-event library instead of fireEvent + act() for user interactions
 * - Trust RTL's automatic act() wrapping for state updates and effects
 * - Use exported resetStorePreservingMocks() for manual validation testing
 * 
 * EXPECTED IMPACT:
 * - Fixes timer-related uncaught exceptions (prevents test crashes)
 * - Maintains complete mock preservation (prevents 40+ additional failures)
 * - Improves mock state isolation (reduces test interference)
 * - Better portal cleanup reliability (reduces DOM pollution)
 * - Enhanced React 19 compatibility with modern testing patterns
 */