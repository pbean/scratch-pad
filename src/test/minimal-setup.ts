/**
 * Minimal Test Setup for Debugging Timeout Issues
 * 
 * This setup file contains only the essential mocks and configurations
 * needed to run React tests, removing all complex timeout handling
 * and performance tracking that might cause hanging issues.
 */

import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// ============================================================================
// BASIC MOCKS - ESSENTIAL ONLY
// ============================================================================

// Mock Tauri API - minimal implementation
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock performance monitoring hooks - disable completely
vi.mock('../../hooks/usePerformanceMonitor', () => ({
  useRenderPerformance: vi.fn(() => ({ metrics: {}, isTracking: false })),
  useMemoryMonitor: vi.fn(() => ({ usage: {}, cleanup: vi.fn() })),
  useStartupPerformance: vi.fn(() => ({ duration: 0, isComplete: true }))
}))

// Mock memory cleanup hooks - disable completely  
vi.mock('../../hooks/useMemoryCleanup', () => ({
  useMemoryCleanup: vi.fn(() => ({ cleanup: vi.fn() })),
  useDataCleanup: vi.fn(() => ({ cleanup: vi.fn() }))
}))

// ============================================================================
// BASIC JSDOM SETUP
// ============================================================================

beforeAll(() => {
  // Essential window mocks only
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: vi.fn().mockReturnValue(true)
  })
  
  // Basic matchMedia mock
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  // Essential observer mocks
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Basic element methods
  Element.prototype.scrollIntoView = vi.fn()
  
  // Simple focus tracking without complex state
  Element.prototype.focus = vi.fn()
  Element.prototype.blur = vi.fn()
  
  // Basic getComputedStyle mock - minimal implementation
  global.getComputedStyle = vi.fn().mockImplementation(() => ({
    getPropertyValue: vi.fn().mockReturnValue(''),
    getPropertyPriority: vi.fn().mockReturnValue(''),
    setProperty: vi.fn(),
    removeProperty: vi.fn(),
    cssText: '',
    length: 0,
    parentRule: null,
    item: vi.fn().mockReturnValue(''),
  }))

  // Basic performance.now mock - no complex timing
  global.performance = global.performance || {} as Performance
  global.performance.now = vi.fn().mockImplementation(() => Date.now())
})

beforeEach(() => {
  // Clear all mocks and timers - essential cleanup only
  vi.clearAllMocks()
  vi.clearAllTimers()
  
  // Reset DOM to clean state
  if (document?.body) {
    document.body.innerHTML = ''
  }
  
  // Create a simple test root element
  const testRoot = document.createElement('div')
  testRoot.setAttribute('id', 'test-root')
  document.body.appendChild(testRoot)
})

afterEach(() => {
  // Essential cleanup only
  cleanup()
  vi.clearAllMocks()
  vi.clearAllTimers()
  
  // Ensure we're using real timers after each test
  vi.useRealTimers()
})

// ============================================================================
// DISABLE COMPLEX FEATURES
// ============================================================================

// Log when minimal setup is loaded
console.log('🔧 Minimal test setup loaded - complex features disabled')

// Override any existing console styling from performance setup
const originalLog = console.log
const originalWarn = console.warn

console.log = (...args) => {
  if (process.env.VITEST_MINIMAL_MODE === 'true') {
    originalLog('[MINIMAL]', ...args)
  } else {
    originalLog(...args)
  }
}

console.warn = (...args) => {
  if (process.env.VITEST_MINIMAL_MODE === 'true') {
    originalWarn('[MINIMAL WARNING]', ...args)
  } else {
    originalWarn(...args)
  }
}