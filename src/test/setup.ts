import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { act } from 'react'

// Global setup to ensure React Testing Library works properly with jsdom
import { configure } from '@testing-library/react'
configure({
  // Use document.body as container by default
  defaultHidden: true,
  // Configure React 19 testing environment
  asyncUtilTimeout: 10000,
  testIdAttribute: 'data-testid',
  getElementError: (message, container) => {
    const prettyDOM = require('@testing-library/dom').prettyDOM
    const error = new Error(
      [message, prettyDOM(container)].filter(Boolean).join('\n\n')
    )
    error.name = 'TestingLibraryElementError'
    return error
  }
})

// Global act function for React 19 compatibility  
// In React 19, most act() calls are automatic, so we provide a simpler implementation
global.act = async (callback) => {
  const result = callback()
  if (result && typeof result.then === 'function') {
    await result
  }
  return result
}

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock Tauri API globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock CSS variables for Tailwind classes
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useLayoutEffect: vi.fn().mockImplementation(actual.useEffect)
  }
})

// Configure React Test Environment globally
Object.defineProperty(global, 'IS_REACT_ACT_ENVIRONMENT', {
  value: true,
  writable: true,
  configurable: true
})

// Global window mocks
beforeAll(() => {
  // Configure React act environment
  window.IS_REACT_ACT_ENVIRONMENT = true
  
  // Suppress React act() warnings in test environment (React 19 handles this automatically)
  const originalConsoleError = console.error
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('The current testing environment is not configured to support act') ||
       args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('act() is not supported') ||
       args[0].includes('Consider adding'))
    ) {
      return // Suppress React testing warnings
    }
    originalConsoleError.apply(console, args)
  }
  
  // Mock window.confirm
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: vi.fn().mockReturnValue(true)
  })
  
  // Mock URL APIs
  Object.defineProperty(window, 'URL', {
    writable: true,
    value: {
      createObjectURL: vi.fn(() => 'mock-blob-url'),
      revokeObjectURL: vi.fn()
    }
  })
  
  // Mock window methods
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

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock Element.scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
  
  // Mock focus and blur methods for all elements with proper focus tracking
  let currentFocusedElement: Element | null = null
  
  Element.prototype.focus = vi.fn().mockImplementation(function(this: Element) {
    currentFocusedElement = this
    this.dispatchEvent(new Event('focus', { bubbles: true }))
  })
  
  Element.prototype.blur = vi.fn().mockImplementation(function(this: Element) {
    if (currentFocusedElement === this) {
      currentFocusedElement = null
    }
    this.dispatchEvent(new Event('blur', { bubbles: true }))
  })
  
  // Mock document.activeElement to return currently focused element
  Object.defineProperty(document, 'activeElement', {
    get: () => currentFocusedElement || document.body,
    configurable: true
  })
  
  // Mock File.text() method
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

  // Mock CSS style computations for tests
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

  // Mock requestAnimationFrame and cancelAnimationFrame
  global.requestAnimationFrame = vi.fn().mockImplementation((cb) => setTimeout(cb, 16))
  global.cancelAnimationFrame = vi.fn().mockImplementation((id) => clearTimeout(id))
  
  // Enhanced keyboard event support
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
})

beforeEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks()
  
  // Reset DOM to clean state
  if (document?.body) {
    document.body.innerHTML = ''
  }
  
  // Create a test root element in body for React components
  const testRoot = document.createElement('div')
  testRoot.setAttribute('id', 'test-root')
  document.body.appendChild(testRoot)
  
  // Reset any global state that might affect tests
  if (global.performance && global.performance.mark) {
    global.performance.mark = vi.fn()
    global.performance.measure = vi.fn()
  }
  
  // Mock document.createElement for each test
  const originalCreateElement = document.createElement.bind(document)
  document.createElement = vi.fn((tagName: string) => {
    if (tagName === 'a') {
      const element = originalCreateElement('a')
      element.click = vi.fn()
      return element
    }
    if (tagName === 'input') {
      const element = originalCreateElement('input')
      element.click = vi.fn()
      return element
    }
    if (tagName === 'textarea') {
      const element = originalCreateElement('textarea')
      element.focus = vi.fn()
      element.blur = vi.fn()
      element.select = vi.fn()
      element.setSelectionRange = vi.fn()
      return element
    }
    return originalCreateElement(tagName)
  })
})