/**
 * Minimal CI Test Setup
 * 
 * Optimized setup file for CI environments that eliminates performance tracking
 * overhead and provides minimal necessary mocks for React 19 compatibility.
 */

import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Global setup to ensure React Testing Library works properly with jsdom
import { configure } from '@testing-library/react'
configure({
  // Use document.body as container by default
  defaultHidden: true,
  // Reasonable timeout for CI environment
  asyncUtilTimeout: 5000,
  testIdAttribute: 'data-testid'
})

// CI-specific cleanup strategy
afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.clearAllMocks()
})

// Mock Tauri API globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Minimal performance start time for CI
let performanceBaseTime = Date.now()

// Global window mocks - minimal set for CI
beforeAll(() => {
  // Essential browser API mocks
  global.requestAnimationFrame = vi.fn().mockImplementation((cb) => setTimeout(cb, 16))
  global.cancelAnimationFrame = vi.fn().mockImplementation((id) => clearTimeout(id))
  
  global.requestIdleCallback = vi.fn().mockImplementation((cb: IdleRequestCallback, options?: IdleRequestOptions) => {
    const timeout = options?.timeout || 50
    return setTimeout(() => {
      // Use microtask for more reliable scheduling in CI
      Promise.resolve().then(() => {
        cb({
          didTimeout: false,
          timeRemaining: () => Math.max(0, timeout - 16)
        })
      })
    }, 16) as any
  })
  global.cancelIdleCallback = vi.fn().mockImplementation((id) => clearTimeout(id as any))
  
  // Window API mocks
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: vi.fn().mockReturnValue(true)
  })
  
  Object.defineProperty(window, 'URL', {
    writable: true,
    value: {
      createObjectURL: vi.fn(() => 'mock-blob-url'),
      revokeObjectURL: vi.fn()
    }
  })
  
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

  // Observer API mocks
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

  // Element method mocks
  if (!Element.prototype.scrollIntoView || typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn()
  }
  
  // Simplified focus/blur handling for CI
  let currentFocusedElement: Element | null = null
  
  const originalFocus = (Element.prototype as any).focus
  if (!vi.isMockFunction(originalFocus)) {
    (Element.prototype as any).focus = vi.fn().mockImplementation(function(this: Element) {
      const element = this
      currentFocusedElement = element
      
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => selector === ':focus'),
        configurable: true
      })
      
      const focusEvent = new Event('focus', { bubbles: true })
      element.dispatchEvent(focusEvent)
    })
  }
  
  const originalBlur = (Element.prototype as any).blur
  if (!vi.isMockFunction(originalBlur)) {
    (Element.prototype as any).blur = vi.fn().mockImplementation(function(this: Element) {
      const element = this
      if (currentFocusedElement === element) {
        currentFocusedElement = null
      }
      
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => selector !== ':focus'),
        configurable: true
      })
      
      const blurEvent = new Event('blur', { bubbles: true })
      element.dispatchEvent(blurEvent)
    })
  }
  
  Object.defineProperty(document, 'activeElement', {
    get: () => currentFocusedElement || document.body,
    configurable: true
  })
  
  // Simplified CSS mocking for CI
  global.getComputedStyle = vi.fn().mockImplementation((element: Element | null) => {
    if (!element) {
      return {
        getPropertyValue: vi.fn().mockReturnValue(''),
        display: 'block',
        pointerEvents: 'auto'
      }
    }
    
    const classList = Array.from(element.classList || [])
    return {
      getPropertyValue: vi.fn().mockImplementation((property: string) => {
        switch (property) {
          case 'display':
            if (classList.includes('flex')) return 'flex'
            if (classList.includes('hidden')) return 'none'
            return 'block'
          case 'pointer-events':
          case 'pointerEvents':
            if (classList.includes('pointer-events-none')) return 'none'
            return 'auto'
          default:
            return ''
        }
      }),
      display: classList.includes('hidden') ? 'none' : 'block',
      pointerEvents: classList.includes('pointer-events-none') ? 'none' : 'auto'
    }
  })
  
  // Event class mocks
  global.KeyboardEvent = class MockKeyboardEvent extends Event {
    public key: string
    public code: string
    public ctrlKey: boolean
    public shiftKey: boolean
    public altKey: boolean
    public metaKey: boolean
    
    constructor(type: string, options: any = {}) {
      super(type, options)
      this.key = options.key || ''
      this.code = options.code || ''
      this.ctrlKey = options.ctrlKey || false
      this.shiftKey = options.shiftKey || false
      this.altKey = options.altKey || false
      this.metaKey = options.metaKey || false
    }
  } as any

  global.PointerEvent = class MockPointerEvent extends MouseEvent {
    public pointerId = 1
    public pointerType = 'mouse'
    public isPrimary = true
    
    constructor(type: string, options: any = {}) {
      super(type, options)
      this.pointerId = options.pointerId || 1
      this.pointerType = options.pointerType || 'mouse'
      this.isPrimary = options.isPrimary !== undefined ? options.isPrimary : true
    }
    
    getCoalescedEvents() { return [] }
    getPredictedEvents() { return [] }
  } as any

  // File API mock
  global.File = class MockFile {
    name: string
    type: string
    content: string
    
    constructor(content: string[], filename: string, options: any = {}) {
      this.name = filename
      this.type = options.type || ''
      this.content = content.join('')
    }
    
    text() {
      return Promise.resolve(this.content)
    }
  } as any

  // CRITICAL FIX: Ultra-simplified performance.now() for CI
  performanceBaseTime = Date.now()
  
  if (!global.performance) {
    global.performance = {} as Performance
  }
  
  // Enhanced bulletproof performance.now() implementation for CI
  global.performance.now = vi.fn().mockImplementation(() => {
    try {
      const now = Date.now()
      if (!isFinite(now) || isNaN(now)) {
        return 0
      }
      const elapsed = now - performanceBaseTime
      if (!isFinite(elapsed) || isNaN(elapsed) || elapsed < 0) {
        return 0
      }
      return Math.max(0, elapsed)
    } catch (error) {
      return 0
    }
  })
  
  global.performance.mark = vi.fn()
  global.performance.measure = vi.fn()
  global.performance.clearMarks = vi.fn()
  global.performance.clearMeasures = vi.fn()
  
  // Simple timeOrigin
  Object.defineProperty(global.performance, 'timeOrigin', {
    get: () => performanceBaseTime,
    configurable: true
  })
})

beforeEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks()
  
  // Reset DOM to clean state
  if (document?.body) {
    document.body.innerHTML = '<div id="test-root"></div>'
  }
  
  // Reset performance base time for each test
  performanceBaseTime = Date.now()
  
  // Ensure performance.now() is always fresh
  if (global.performance) {
    global.performance.now = vi.fn().mockImplementation(() => {
      const now = Date.now()
      const elapsed = now - performanceBaseTime
      return Math.max(0, elapsed || 0)
    })
  }
})

export const waitForStableDOM = async (_timeout: number = 3000): Promise<void> => {
  return new Promise((resolve) => {
    // Simplified for CI - just wait for next tick
    setTimeout(resolve, 0)
  })
}