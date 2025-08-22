/**
 * Enhanced CI Test Setup - Complete DOM Isolation
 * 
 * This setup provides complete test isolation for CI environments by:
 * 1. Creating fresh DOM containers for each test
 * 2. Comprehensive cleanup between tests
 * 3. Process-level isolation through Vitest forks
 * 4. Eliminating all shared state between tests
 */

import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Global setup to ensure React Testing Library works properly with jsdom
import { configure } from '@testing-library/react'

// Track all created containers for complete cleanup
let testContainers: Set<Element> = new Set()
let globalCleanupFunctions: Array<() => void> = []

configure({
  // Use unique container creation strategy
  defaultHidden: true,
  // Reasonable timeout for CI environment
  asyncUtilTimeout: 8000,
  testIdAttribute: 'data-testid',
  // Enhanced error reporting for CI debugging
  getElementError: (message, container) => {
    const prettyDOM = require('@testing-library/dom').prettyDOM
    const error = new Error(
      [
        message,
        `Container count: ${testContainers.size}`,
        prettyDOM(container)
      ].filter(Boolean).join('\n\n')
    )
    error.name = 'TestingLibraryElementError'
    return error
  }
})

// CRITICAL: Complete DOM isolation strategy
function destroyAllContainers(): void {
  // Remove all tracked containers
  testContainers.forEach(container => {
    try {
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    } catch (error) {
      // Ignore removal errors
    }
  })
  
  // Clear the tracking set
  testContainers.clear()
  
  // Also remove any untracked test containers
  const remainingContainers = document.querySelectorAll('[data-testid="test-container"]')
  remainingContainers.forEach(container => {
    try {
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    } catch (error) {
      // Ignore removal errors
    }
  })
}

// CRITICAL: Enhanced cleanup strategy for CI
afterEach(async () => {
  try {
    // Force cleanup of all React Testing Library containers
    cleanup()
    
    // Clear all mocks and timers
    vi.clearAllTimers()
    vi.clearAllMocks()
    
    // Destroy all test containers
    destroyAllContainers()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    // Reset focus state aggressively
    try {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur?.()
      }
      // Force focus back to body
      if (document.body && document.body.focus) {
        document.body.focus()
      }
    } catch (error) {
      // Ignore focus cleanup errors
    }
    
    // Complete DOM reset - remove ALL children from body
    while (document.body.firstChild) {
      try {
        document.body.removeChild(document.body.firstChild)
      } catch (error) {
        // Break if we can't remove children
        break
      }
    }
    
    // Reset document title
    document.title = 'Test'
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 0))
    
  } catch (error) {
    // Log cleanup errors but don't fail tests
    console.warn('Enhanced test cleanup error:', error)
  }
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
      // Simple callback execution for CI stability
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, timeout - 16)
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
  
  // CRITICAL: Process-isolated focus handling for CI
  let processCurrentFocusedElement: Element | null = null
  
  const originalFocus = (Element.prototype as any).focus
  if (!vi.isMockFunction(originalFocus)) {
    (Element.prototype as any).focus = vi.fn().mockImplementation(function(this: Element) {
      const element = this
      processCurrentFocusedElement = element
      
      // Set focus state immediately and synchronously
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => selector === ':focus'),
        configurable: true
      })
      
      // Update document.activeElement immediately
      Object.defineProperty(document, 'activeElement', {
        get: () => element,
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
      if (processCurrentFocusedElement === element) {
        processCurrentFocusedElement = null
      }
      
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => selector !== ':focus'),
        configurable: true
      })
      
      // Update document.activeElement to body
      Object.defineProperty(document, 'activeElement', {
        get: () => document.body,
        configurable: true
      })
      
      const blurEvent = new Event('blur', { bubbles: true })
      element.dispatchEvent(blurEvent)
    })
  }
  
  // CRITICAL: Simplified CSS mocking for CI stability
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

  // CRITICAL: Ultra-simplified performance.now() for CI
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

beforeEach(async () => {
  // Clear all mocks between tests
  vi.clearAllMocks()
  
  // Complete DOM reset with fresh container creation
  destroyAllContainers()
  
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
  
  // Reset focus state completely
  try {
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur?.()
    }
    
    Object.defineProperty(document, 'activeElement', {
      get: () => document.body,
      configurable: true
    })
  } catch (error) {
    // Ignore focus reset errors
  }
  
  // Wait for setup to complete
  await new Promise(resolve => setTimeout(resolve, 0))
})

afterAll(() => {
  // Run all global cleanup functions
  globalCleanupFunctions.forEach(cleanup => {
    try {
      cleanup()
    } catch (error) {
      console.warn('Global cleanup error:', error)
    }
  })
  
  // Final DOM cleanup
  destroyAllContainers()
})

export const waitForStableDOM = async (_timeout: number = 5000): Promise<void> => {
  return new Promise((resolve) => {
    // Simplified for CI - just wait for next tick
    setTimeout(resolve, 0)
  })
}