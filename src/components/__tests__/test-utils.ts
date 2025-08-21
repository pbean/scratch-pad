/**
 * Test Utilities for Scratch Pad Components
 * 
 * Provides reusable mocking infrastructure for:
 * - Toast notification system
 * - Timer-based auto-dismiss functionality  
 * - Store integration patterns
 * - Async operation testing
 */

import { vi } from 'vitest'

// Toast mock utilities
export const createMockToast = () => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
})

// Setup function for toast-dependent tests
export const setupToastMocks = () => {
  const mockToast = createMockToast()
  vi.mock('@/lib/useToast', () => ({
    useToast: () => mockToast,
  }))
  return mockToast
}

// Timer utilities for auto-dismiss testing
export const setupTimerMocks = () => {
  vi.useFakeTimers()
  return {
    advanceTimers: (ms: number) => vi.advanceTimersByTime(ms),
    cleanup: () => vi.useRealTimers(),
  }
}

// Store utilities for state management testing
export const createMockStore = () => ({
  notes: [],
  currentView: 'note',
  searchResults: [],
  settings: {},
  isLoading: false,
  error: null,
  
  // Mock actions
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  searchNotes: vi.fn(),
  setSetting: vi.fn(),
  loadNotes: vi.fn(),
  setView: vi.fn(),
  clearError: vi.fn(),
})

// Combined setup for complex component tests
export const setupComplexTestEnvironment = () => {
  const mockToast = setupToastMocks()
  const timerUtils = setupTimerMocks()
  const mockStore = createMockStore()
  
  // Mock Tauri API
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
  }))
  
  return {
    mockToast,
    timerUtils,
    mockStore,
    cleanup: () => {
      timerUtils.cleanup()
      vi.clearAllMocks()
    }
  }
}

// Wait helpers for async testing
export const waitForToast = async (mockToast: any, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
  await vi.waitFor(() => {
    expect(mockToast[type]).toHaveBeenCalled()
  })
}

export const waitForTimerCompletion = async (timerUtils: any, duration: number) => {
  timerUtils.advanceTimers(duration)
  await new Promise(resolve => setTimeout(resolve, 0))
}