import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { 
  setupReact19Timeouts, 
  cleanupReact19Timeouts,
  DEFAULT_REACT19_CONFIG 
} from './async-timeout-utils'

// Global setup to ensure React Testing Library works properly with jsdom
import { configure } from '@testing-library/react'
configure({
  // Use document.body as container by default
  defaultHidden: true,
  // Configure React 19 testing environment - optimized timeout for React 19's automatic batching
  asyncUtilTimeout: DEFAULT_REACT19_CONFIG.timeout,
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

// Setup React 19-optimized timeouts
setupReact19Timeouts()

// FE-007: Update cleanup strategy for React 19 concurrent mode
afterEach(() => {
  // React 19 handles cleanup more efficiently with concurrent features
  cleanup()
  
  // Clear any pending timers and animations
  vi.clearAllTimers()
  vi.clearAllMocks()
  
  // Clean up React 19-specific timeout state
  cleanupReact19Timeouts()
})

// Mock Tauri API globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// FE-005: Remove useLayoutEffect mock (React 19 handles this properly)
// FE-003: Remove manual act() environment configuration (React 19 handles automatically)

// Global window mocks
beforeAll(() => {
  // Enhanced requestAnimationFrame and cancelAnimationFrame with React 19 timing
  // MUST be defined early before any component might use them
  global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
    // React 19 uses 16ms intervals for concurrent scheduling
    return setTimeout(cb, 16)
  })
  global.cancelAnimationFrame = vi.fn().mockImplementation((id) => clearTimeout(id))
  
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
  if (!Element.prototype.scrollIntoView || typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn()
  }
  
  // Mock focus and blur methods for all elements with proper focus tracking
  let currentFocusedElement: Element | null = null
  
  // Extend Element prototype with focus/blur methods (for test environment)
  // Only set up if not already mocked
  if (!Element.prototype.focus || !vi.isMockFunction(Element.prototype.focus)) {
    (Element.prototype as any).focus = vi.fn().mockImplementation(function(this: Element) {
      currentFocusedElement = this
      this.dispatchEvent(new Event('focus', { bubbles: true }))
    });
  }
  
  if (!Element.prototype.blur || !vi.isMockFunction(Element.prototype.blur)) {
    (Element.prototype as any).blur = vi.fn().mockImplementation(function(this: Element) {
      if (currentFocusedElement === this) {
        currentFocusedElement = null
      }
      this.dispatchEvent(new Event('blur', { bubbles: true }))
    })
  }
  
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

  // Enhanced CSS style computations for Tailwind CSS compatibility
  const tailwindClassMap: Record<string, string> = {
    // Common Tailwind classes and their computed style values
    'h-screen': '100vh',
    'w-screen': '100vw', 
    'h-full': '100%',
    'w-full': '100%',
    'flex': 'flex',
    'hidden': 'none',
    'block': 'block',
    'inline': 'inline',
    'inline-block': 'inline-block',
    'text-sm': '14px',
    'text-base': '16px',
    'text-lg': '18px',
    'text-xl': '20px',
    'p-2': '8px',
    'p-4': '16px',
    'px-3': '12px',
    'py-2': '8px',
    'm-2': '8px',
    'm-4': '16px',
    'border': '1px solid #d1d5db',
    'rounded': '4px',
    'rounded-md': '6px',
    'bg-white': '#ffffff',
    'bg-gray-50': '#f9fafb',
    'text-black': '#000000',
    'text-gray-900': '#111827',
    'overflow-hidden': 'hidden',
    'cursor-pointer': 'pointer'
  }
  
  global.getComputedStyle = vi.fn().mockImplementation((element: Element | null) => {
    // Handle null/undefined element gracefully
    if (!element) {
      return {
        getPropertyValue: vi.fn().mockReturnValue(''),
        getPropertyPriority: vi.fn().mockReturnValue(''),
        setProperty: vi.fn(),
        removeProperty: vi.fn(),
        cssText: '',
        length: 0,
        parentRule: null,
        item: vi.fn().mockReturnValue(''),
        pointerEvents: 'auto',
        display: 'block',
        width: 'auto',
        height: 'auto',
        fontSize: '16px',
        padding: '0px',
        margin: '0px',
        backgroundColor: 'transparent',
        color: '#000000',
        cursor: 'auto',
        overflow: 'visible'
      }
    }
    
    const classList = Array.from(element.classList || [])
    
    // Create base style object with all properties
    const styleObject: any = {
      getPropertyValue: vi.fn().mockImplementation((property: string) => {
        // Map CSS properties to common values based on Tailwind classes
        switch (property) {
          case 'display':
            if (classList.includes('flex')) return 'flex'
            if (classList.includes('hidden')) return 'none'
            if (classList.includes('block')) return 'block'
            if (classList.includes('inline')) return 'inline'
            if (classList.includes('inline-block')) return 'inline-block'
            return 'block' // default
          
          case 'width':
            if (classList.includes('w-full')) return '100%'
            if (classList.includes('w-screen')) return '100vw'
            return 'auto'
            
          case 'height':
            if (classList.includes('h-full')) return '100%'
            if (classList.includes('h-screen')) return '100vh'
            return 'auto'
            
          case 'font-size':
            if (classList.includes('text-sm')) return '14px'
            if (classList.includes('text-base')) return '16px'
            if (classList.includes('text-lg')) return '18px'
            if (classList.includes('text-xl')) return '20px'
            return '16px' // default
            
          case 'padding':
            if (classList.includes('p-2')) return '8px'
            if (classList.includes('p-4')) return '16px'
            return '0px'
            
          case 'margin':
            if (classList.includes('m-2')) return '8px'
            if (classList.includes('m-4')) return '16px'
            return '0px'
            
          case 'background-color':
            if (classList.includes('bg-white')) return '#ffffff'
            if (classList.includes('bg-gray-50')) return '#f9fafb'
            return 'transparent'
            
          case 'color':
            if (classList.includes('text-black')) return '#000000'
            if (classList.includes('text-gray-900')) return '#111827'
            return '#000000'
            
          case 'cursor':
            if (classList.includes('cursor-pointer')) return 'pointer'
            return 'auto'
            
          case 'overflow':
            if (classList.includes('overflow-hidden')) return 'hidden'
            return 'visible'
            
          case 'pointer-events':
          case 'pointerEvents':
            // Support both kebab-case and camelCase
            if (classList.includes('pointer-events-none')) return 'none'
            if (classList.includes('pointer-events-auto')) return 'auto'
            return 'auto' // default
            
          default:
            // Check if any class matches our map for this property
            for (const className of classList) {
              if (tailwindClassMap[className]) {
                return tailwindClassMap[className]
              }
            }
            return ''
        }
      }),
      getPropertyPriority: vi.fn().mockReturnValue(''),
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
      cssText: '',
      length: 0,
      parentRule: null,
      item: vi.fn().mockReturnValue(''),
      // Add direct property access for common CSS properties
      pointerEvents: 'auto',
      display: 'block',
      width: 'auto',
      height: 'auto',
      fontSize: '16px',
      padding: '0px',
      margin: '0px',
      backgroundColor: 'transparent',
      color: '#000000',
      cursor: 'auto',
      overflow: 'visible'
    }
    
    // Update direct properties based on classes
    if (classList.includes('pointer-events-none')) styleObject.pointerEvents = 'none'
    if (classList.includes('pointer-events-auto')) styleObject.pointerEvents = 'auto'
    if (classList.includes('flex')) styleObject.display = 'flex'
    if (classList.includes('hidden')) styleObject.display = 'none'
    if (classList.includes('cursor-pointer')) styleObject.cursor = 'pointer'
    
    return styleObject
  })
  
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

  // Add PointerEvent mock support for React 19 compatibility
  global.PointerEvent = class MockPointerEvent extends MouseEvent {
    public pointerId: number
    public width: number
    public height: number
    public pressure: number
    public tangentialPressure: number
    public tiltX: number
    public tiltY: number
    public twist: number
    public pointerType: string
    public isPrimary: boolean
    
    constructor(type: string, options: any = {}) {
      super(type, options)
      this.pointerId = options.pointerId || 1
      this.width = options.width || 1
      this.height = options.height || 1
      this.pressure = options.pressure || 0
      this.tangentialPressure = options.tangentialPressure || 0
      this.tiltX = options.tiltX || 0
      this.tiltY = options.tiltY || 0
      this.twist = options.twist || 0
      this.pointerType = options.pointerType || 'mouse'
      this.isPrimary = options.isPrimary !== undefined ? options.isPrimary : true
    }
    
    // Mock pointer event methods
    getCoalescedEvents() {
      return []
    }
    
    getPredictedEvents() {
      return []
    }
  } as any

  // Add pointer event support to elements
  const originalAddEventListener = Element.prototype.addEventListener
  Element.prototype.addEventListener = vi.fn().mockImplementation(function(
    this: Element,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    // Support pointer events by mapping to mouse events for testing
    const pointerToMouseEventMap: Record<string, string> = {
      'pointerdown': 'mousedown',
      'pointerup': 'mouseup',
      'pointermove': 'mousemove',
      'pointerenter': 'mouseenter',
      'pointerleave': 'mouseleave',
      'pointerover': 'mouseover',
      'pointerout': 'mouseout'
    }
    
    const mappedType = pointerToMouseEventMap[type] || type
    return originalAddEventListener.call(this, mappedType, listener, options)
  })

  // Enhanced performance.now() mock for React 19 scheduling
  const startTime = Date.now()
  global.performance = global.performance || {} as Performance
  global.performance.now = vi.fn().mockImplementation(() => Date.now() - startTime)
  global.performance.mark = vi.fn()
  global.performance.measure = vi.fn()
  global.performance.clearMarks = vi.fn()
  global.performance.clearMeasures = vi.fn()
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

  // Reset React 19-specific timeout configurations
  setupReact19Timeouts()
})