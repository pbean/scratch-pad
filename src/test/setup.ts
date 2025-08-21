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
      args[0].includes('The current testing environment is not configured to support act')
    ) {
      return // Suppress React act() warnings
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
    return originalCreateElement(tagName)
  })
})