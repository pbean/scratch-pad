import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock Tauri API globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Global window mocks
beforeAll(() => {
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
  
  // Let jsdom handle focus/blur naturally - React 19 works better without mocks
  
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

  // Enhanced getComputedStyle mock for better React Testing Library compatibility
  const originalGetComputedStyle = window.getComputedStyle
  window.getComputedStyle = vi.fn().mockImplementation((element) => {
    // Create a default result object
    const defaultResult = {
      getPropertyValue: (prop: string) => {
        if (prop === 'pointer-events') return 'auto'
        if (prop === 'display') return 'block'
        if (prop === 'visibility') return 'visible'
        if (prop === 'opacity') return '1'
        return ''
      },
      visibility: 'visible',
      display: 'block',
      pointerEvents: 'auto',
      opacity: '1',
      cssText: '',
      length: 0,
      parentRule: null,
    }
    
    // Check if element is valid
    if (!element) {
      return defaultResult
    }
    
    // For textarea elements, ensure they're visible
    if (element.tagName === 'TEXTAREA' || element.role === 'textbox') {
      return {
        getPropertyValue: (prop: string) => {
          if (prop === 'pointer-events') return 'auto'
          if (prop === 'display') return 'block'
          if (prop === 'visibility') return 'visible'
          if (prop === 'opacity') return '1'
          return ''
        },
        pointerEvents: 'auto',
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        cssText: '',
        length: 0,
        parentRule: null,
      }
    }
    
    // Default return for other elements - use defaultResult to ensure consistency
    return defaultResult
  })
  
  // Set on global as well
  global.getComputedStyle = window.getComputedStyle

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
  
  // Let jsdom handle createElement naturally - don't mock element methods
})