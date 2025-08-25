import '@testing-library/jest-dom'
import React from 'react'
import { vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanup, configure, waitFor, screen, act } from '@testing-library/react'
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

/**
 * COMPONENT TIMEOUT CONSTANTS
 * Tiered timeout strategy based on component complexity as per synthesis plan
 */
export const COMPONENT_TIMEOUTS = {
  simple: 3000,    // buttons, inputs, basic components
  complex: 5000,   // command palette, settings with async operations
  virtual: 7000    // virtual lists with intersection observer
}

/**
 * Wait for component to be ready with proper timeout
 */
export async function waitForComponentReady(testId: string, timeout = COMPONENT_TIMEOUTS.simple) {
  return waitFor(() => {
    expect(screen.getByTestId(testId)).toBeInTheDocument()
  }, { timeout })
}

/**
 * Flush microtasks with act() wrapper for React 19 compatibility
 */
export async function flushMicrotasks() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

/**
 * Async component rendering helper with proper act() handling
 */
export async function renderAsyncComponent(Component: React.ComponentType<any>, props = {}) {
  let result: any
  await act(async () => {
    result = render(React.createElement(Component, props))
    await flushMicrotasks()
  })
  return result
}

/**
 * Store state setup helper - synchronous to avoid act() overlaps
 * FIX: Enhanced to provide complete state defaults for proper component initialization
 */
export function setupStoreState(state: Partial<any>) {
  // Merge with intelligent defaults to ensure components have required state
  const enhancedState = {
    // Provide reasonable defaults for component initialization
    currentView: 'note',
    isCommandPaletteOpen: false,
    isLoading: false,
    error: null,
    notes: [],
    searchHistory: [],
    activeNoteId: null,
    expandedFolders: new Set(["recent", "all-notes"]),
    
    // Core store methods - ensure they exist as functions
    setCurrentView: vi.fn(),
    setCommandPaletteOpen: vi.fn(), 
    setSearchHistory: vi.fn(),
    setActiveNoteId: vi.fn(),
    openNote: vi.fn(),
    searchNotesPaginated: vi.fn().mockResolvedValue({
      notes: [],
      has_more: false,
      total_count: 0
    }),
    setError: vi.fn(),
    
    // Merge user-provided state on top
    ...state
  }
  
  useScratchPadStore.setState(enhancedState, false) // false = partial update
}

/**
 * User interaction helper with configurable delay
 */
export async function performUserAction(
  action: () => Promise<void>,
  delay = 50
) {
  await act(async () => {
    await action()
    await new Promise(resolve => setTimeout(resolve, delay))
  })
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

  // CRITICAL FIX: Move cleanup() BEFORE DOM manipulation to prevent multiple renders
  // Phase 6: Let React Testing Library handle React cleanup FIRST
  cleanup()
  
  // Phase 7: Manual DOM cleanup AFTER React is fully unmounted
  // Use synchronous operations only - no act() wrapper needed
  
  // Clean portal containers (more conservative approach)
  const portalRoot = document.getElementById('radix-portal-root')
  if (portalRoot && portalRoot.children.length > 0) {
    portalRoot.innerHTML = ''
  }
  
  // Clean specific portal containers that might be orphaned
  document.querySelectorAll('[data-radix-portal]').forEach(el => {
    // Only remove if it appears to be an orphaned portal
    if (!el.closest('[data-testid]')) {
      el.remove()
    }
  })
  
  // Clean up dialogs and overlays that are clearly test artifacts
  document.querySelectorAll('[data-testid="dialog-overlay"], .palette-backdrop').forEach(el => {
    el.remove()
  })
  
  // Conservative root cleanup - only clear if it has test artifacts
  const root = document.getElementById('root')
  if (root) {
    // Only clear root if it has obvious test content
    const hasTestContent = root.querySelector('[data-testid], [role="dialog"], .palette-backdrop')
    if (hasTestContent) {
      root.innerHTML = ''
    }
  }
  
  // FIX 4: More Conservative Portal Cleanup 
  // Reduced retry logic - only remove clearly orphaned elements
  let cleanupAttempts = 0
  const maxCleanupAttempts = 3 // Reduced from 10
  
  while (cleanupAttempts < maxCleanupAttempts) {
    try {
      const bodyChildren = Array.from(document.body.children)
      const potentialOrphans = bodyChildren.filter(el => 
        el.id !== 'root' && 
        !el.hasAttribute('data-react-19-internal') && 
        !el.matches('script, style, link, meta') &&
        // Only target elements that look like test artifacts
        (el.hasAttribute('data-testid') || 
         el.hasAttribute('data-radix-portal') || 
         el.matches('[role="dialog"], .palette-backdrop'))
      )
      
      if (potentialOrphans.length === 0) {
        // Success: no obvious test artifacts remain
        break
      }
      
      // Remove only clearly identified test artifacts
      potentialOrphans.forEach(el => {
        try {
          el.remove()
        } catch (e) {
          // Ignore removal errors for React-managed elements
        }
      })
      
      cleanupAttempts++
      
    } catch (e) {
      // Ignore cleanup errors - React 19 is more forgiving
      break
    }
  }
  
  // Note: No manual act() wrapper - React 19 + RTL handle this automatically
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

// PERFORMANCE COMPONENT MOCKS - Mock the entire performance components
// This prevents complex hook dependencies and ensures SettingsView renders properly
vi.mock('../components/performance/PerformanceDashboard', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'performance-dashboard', ...props }, 'Performance Dashboard')
}))

vi.mock('../components/performance/PerformanceAlertManager', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'performance-alert-manager', ...props }, 'Performance Alert Manager')
}))

vi.mock('../components/performance/OptimizationRecommendations', () => ({
  default: ({ ...props }: any) => React.createElement('div', { 'data-testid': 'optimization-recommendations', ...props }, 'Optimization Recommendations')
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

// Remove duplicate performance component mocks - consolidated above

/*
 * REACT 19 TESTING INFRASTRUCTURE FIXES APPLIED + DEBUGGING FIXES:
 * 
 * FIX 1: ✅ Timer Mock Cleanup (HIGHEST PRIORITY)
 *   - Added vi.clearAllTimers() BEFORE vi.useRealTimers() at line 268
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
 *   - Added comprehensive mock clearing after resetStoreSpies() at line 289
 *   - Iterates through current state and calls mockClear() on any vi.fn() instances
 *   - Prevents mock state bleeding between tests
 * 
 * FIX 4: ✅ Enhanced Portal Cleanup (SAFER VERSION)
 *   - Replaced async waitFor with synchronous retry logic after line 334
 *   - Maximum 3 retries (reduced from 10) with targeted removal
 *   - Only removes clearly identified test artifacts
 * 
 * DEBUGGING FIXES (NEW):
 * 
 * FIX 5: ✅ Cleanup Order Correction
 *   - Moved cleanup() call BEFORE DOM manipulation (line 324)
 *   - Prevents multiple component instances by ensuring React unmounts first
 * 
 * FIX 6: ✅ Enhanced setupStoreState 
 *   - Provides complete default state for component initialization (line 234)
 *   - Includes essential store methods with sensible defaults
 *   - Ensures SearchHistoryView and other components have required dependencies
 * 
 * FIX 7: ✅ Conservative Portal Cleanup
 *   - More targeted removal of DOM elements (lines 327-385)
 *   - Only removes clearly identified test artifacts  
 *   - Reduced retry attempts to prevent over-aggressive cleanup
 * 
 * EXPECTED IMPACT:
 * - Resolves "Found multiple elements" errors (CommandPalette, SettingsView)
 * - Fixes "Unable to find element" errors (SearchHistoryView)
 * - Improves test stability by 25-30 tests (~80% → 92%+ pass rate)
 * - Maintains existing infrastructure improvements from Session 36
 */