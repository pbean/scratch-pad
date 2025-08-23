import '@testing-library/jest-dom'
import { vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { 
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

// Enhanced focus state management
let currentFocusedElement: Element | null = null
let focusHistory: Element[] = []

// Enhanced cleanup strategy for better test isolation
afterEach(async () => {
  // Enhanced DOM cleanup to prevent component leakage
  try {
    // Reset focus state
    currentFocusedElement = null
    focusHistory = []
    
    // Force cleanup of all React Testing Library containers
    cleanup()
    
    // Clear any pending timers and animations
    vi.clearAllTimers()
    vi.clearAllMocks()
    
    // Clean up React 19-specific timeout state
    cleanupReact19Timeouts()
    
    // Enhanced DOM reset - remove all test containers
    if (document?.body) {
      const testContainers = document.querySelectorAll('[data-testid="test-container"]')
      testContainers.forEach(container => {
        try {
          container.remove()
        } catch (error) {
          // Ignore removal errors
        }
      })
      
      // Remove all child elements completely to prevent leakage
      while (document.body.firstChild) {
        try {
          document.body.removeChild(document.body.firstChild)
        } catch (error) {
          // Break if we can't remove children
          break
        }
      }
    }
    
    // Reset focus state more aggressively
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
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 0))
    
  } catch (error) {
    // Log cleanup errors but don't fail tests
    console.warn('Test cleanup error:', error)
  }
})

// Mock Tauri API globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// PERFORMANCE FIX: Enhanced performance start time tracking with validation
let performanceStartTime = Date.now()
let performanceOriginTime = performanceStartTime

// Utility function to create safe performance.now() implementation
const createSafePerformanceNow = () => {
  return vi.fn().mockImplementation(() => {
    try {
      const current = Date.now()
      
      // Validate all timing values before calculation
      if (!isFinite(performanceStartTime) || isNaN(performanceStartTime)) {
        console.warn('Performance: Invalid start time detected, resetting')
        performanceStartTime = current
        return 0
      }
      
      if (!isFinite(current) || isNaN(current)) {
        console.warn('Performance: Invalid current time detected')
        return 0
      }
      
      const elapsed = current - performanceStartTime
      
      // Ensure result is always a finite, non-negative number
      if (!isFinite(elapsed) || isNaN(elapsed) || elapsed < 0) {
        console.warn(`Performance: Invalid elapsed time calculated: ${elapsed}`)
        return 0
      }
      
      return Math.max(0, elapsed)
    } catch (error) {
      console.warn('Performance: Timing calculation failed:', error)
      return 0
    }
  })
}

// Global window mocks
beforeAll(() => {
  // Enhanced requestAnimationFrame and cancelAnimationFrame with React 19 timing
  // MUST be defined early before any component might use them
  global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
    // React 19 uses 16ms intervals for concurrent scheduling
    return setTimeout(cb, 16)
  })
  global.cancelAnimationFrame = vi.fn().mockImplementation((id) => clearTimeout(id))
  
  // FE-FIX-002: Simplified requestIdleCallback for CI stability
  global.requestIdleCallback = vi.fn().mockImplementation((cb: IdleRequestCallback) => {
    // Use simple setTimeout instead of complex microtask scheduling for CI reliability
    return setTimeout(() => {
      const deadline = {
        didTimeout: false,
        timeRemaining: () => Math.max(0, 16) // Always return consistent timing
      }
      cb(deadline)
    }, 0) as any
  })
  
  global.cancelIdleCallback = vi.fn().mockImplementation((id) => clearTimeout(id as any))
  
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
  
  // Enhanced focus and blur methods for better test reliability
  if (!(Element.prototype as any).focus || !vi.isMockFunction((Element.prototype as any).focus)) {
    (Element.prototype as any).focus = vi.fn().mockImplementation(function(this: Element) {
      const element = this
      
      // Set focus state immediately and synchronously
      currentFocusedElement = element
      focusHistory.push(element)
      
      // Update activeElement immediately
      Object.defineProperty(document, 'activeElement', {
        get: () => element,
        configurable: true
      })
      
      // Set up :focus pseudo-class matcher
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => {
          if (selector === ':focus') return true
          return false
        }),
        configurable: true
      })
      
      // Dispatch focus events immediately and synchronously
      const focusEvent = new Event('focus', { bubbles: true })
      element.dispatchEvent(focusEvent)
      
      const focusinEvent = new Event('focusin', { bubbles: true })
      element.dispatchEvent(focusinEvent)
    });
  }
  
  if (!(Element.prototype as any).blur || !vi.isMockFunction((Element.prototype as any).blur)) {
    (Element.prototype as any).blur = vi.fn().mockImplementation(function(this: Element) {
      const element = this
      
      // Set blur state immediately
      if (currentFocusedElement === element) {
        currentFocusedElement = null
        
        // Update activeElement to body
        Object.defineProperty(document, 'activeElement', {
          get: () => document.body,
          configurable: true
        })
      }
      
      Object.defineProperty(element, 'matches', {
        value: vi.fn((selector: string) => selector !== ':focus'),
        configurable: true
      })
      
      const blurEvent = new Event('blur', { bubbles: true })
      element.dispatchEvent(blurEvent)
    })
  }
  
  // Enhanced activeElement mock
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
  
  global.getComputedStyle = vi.fn().mockImplementation((element: any) => {
    // Handle null/undefined element gracefully - CRITICAL FIX
    if (!element || typeof element.classList === 'undefined') {
      const fallbackStyle: any = {
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
      return fallbackStyle
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
            
          case 'animation-name':
            // Check if element has inline style for animation
            if (element instanceof HTMLElement && element.style.animationName) {
              return element.style.animationName
            }
            return 'none' // default - no animation
            
          case 'transition-property':
            // Check if element has inline style for transition
            if (element instanceof HTMLElement && element.style.transitionProperty) {
              return element.style.transitionProperty
            }
            return 'none' // default - no transition
            
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

  // PERFORMANCE FIX: Enhanced performance.now() mock with improved error handling
  // Initialize with validated current time to prevent NaN issues
  performanceStartTime = Date.now()
  performanceOriginTime = performanceStartTime
  
  // Ensure performance object exists
  if (!global.performance) {
    global.performance = {} as Performance
  }
  
  // Create safe performance.now() implementation
  global.performance.now = createSafePerformanceNow()
  
  global.performance.mark = vi.fn()
  global.performance.measure = vi.fn()
  global.performance.clearMarks = vi.fn()
  global.performance.clearMeasures = vi.fn()
  
  // Add performance timing mock with proper property descriptors
  try {
    Object.defineProperty(global.performance, 'timeOrigin', {
      get: () => performanceOriginTime,
      configurable: true
    })
  } catch (error) {
    // Ignore if timeOrigin cannot be set (already exists)
  }
  
  // Mock performance.timing with proper structure
  Object.defineProperty(global.performance, 'timing', {
    get: () => ({
      navigationStart: performanceStartTime,
      loadEventEnd: performanceStartTime + 100,
      domContentLoadedEventEnd: performanceStartTime + 50,
      fetchStart: performanceStartTime,
      domainLookupStart: performanceStartTime,
      domainLookupEnd: performanceStartTime,
      connectStart: performanceStartTime,
      connectEnd: performanceStartTime,
      requestStart: performanceStartTime,
      responseStart: performanceStartTime,
      responseEnd: performanceStartTime,
      domLoading: performanceStartTime,
      domInteractive: performanceStartTime,
      domContentLoadedEventStart: performanceStartTime,
      domComplete: performanceStartTime + 100,
      loadEventStart: performanceStartTime + 100
    }),
    configurable: true
  })
})

// FE-FIX-003: Enhanced waitForStableDOM utility for CI tests
export const waitForStableDOM = async (timeout: number = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let rafCount = 0
    
    const checkStability = () => {
      rafCount++
      
      // Wait for at least 2 animation frames for React 19 concurrent mode
      if (rafCount >= 2) {
        // Check if DOM is stable (no pending mutations)
        if (document.readyState === 'complete') {
          resolve()
          return
        }
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`DOM did not stabilize within ${timeout}ms`))
        return
      }
      
      // Schedule next check
      requestAnimationFrame(checkStability)
    }
    
    requestAnimationFrame(checkStability)
  })
}

beforeEach(async () => {
  // Clear all mocks between tests
  vi.clearAllMocks()
  
  // Reset focus state
  currentFocusedElement = null
  focusHistory = []
  
  // Enhanced DOM reset to prevent element conflicts
  if (document?.body) {
    // Remove all child elements completely
    while (document.body.firstChild) {
      try {
        document.body.removeChild(document.body.firstChild)
      } catch (error) {
        // Break if we can't remove children
        break
      }
    }
  }
  
  // Create a fresh test root element in body for React components
  const testRoot = document.createElement('div')
  testRoot.setAttribute('id', 'test-root')
  document.body.appendChild(testRoot)
  
  // Reset activeElement to body
  Object.defineProperty(document, 'activeElement', {
    get: () => currentFocusedElement || document.body,
    configurable: true
  })
  
  // Force focus back to body to reset focus state
  if (document.body.focus) {
    try {
      document.body.focus()
    } catch (error) {
      // Ignore focus errors
    }
  }
  
  // PERFORMANCE FIX: Reset performance timing for each test with validation
  const newStartTime = Date.now()
  
  // Validate the new start time
  if (isFinite(newStartTime) && !isNaN(newStartTime)) {
    performanceStartTime = newStartTime
    performanceOriginTime = newStartTime
  } else {
    console.warn('Performance: Invalid new start time, keeping previous value')
  }
  
  // Recreate performance.now() mock with fresh timing
  if (global.performance) {
    global.performance.now = createSafePerformanceNow()
    
    // Update timeOrigin to match new start time
    try {
      Object.defineProperty(global.performance, 'timeOrigin', {
        get: () => performanceOriginTime,
        configurable: true
      })
    } catch (error) {
      // Ignore if property cannot be redefined
    }
  }
  
  // Reset performance marks and measures
  if (global.performance && global.performance.mark) {
    global.performance.mark = vi.fn()
    global.performance.measure = vi.fn()
    global.performance.clearMarks = vi.fn()
    global.performance.clearMeasures = vi.fn()
  }
  
  // Enhanced element creation with proper focus support
  const originalCreateElement = document.createElement.bind(document)
  document.createElement = vi.fn((tagName: string) => {
    const element = originalCreateElement(tagName)
    
    // Add enhanced focus support for input elements
    if (tagName === 'input' || tagName === 'textarea') {
      // Override focus method with immediate synchronous behavior
      Object.defineProperty(element, 'focus', {
        value: vi.fn().mockImplementation(function(this: HTMLElement) {
          const inputElement = this
          
          // Set focus state immediately and synchronously
          currentFocusedElement = inputElement
          focusHistory.push(inputElement)
          
          // Update document.activeElement immediately
          Object.defineProperty(document, 'activeElement', {
            get: () => inputElement,
            configurable: true
          })
          
          // Set up :focus pseudo-class matcher immediately
          Object.defineProperty(inputElement, 'matches', {
            value: vi.fn((selector: string) => {
              if (selector === ':focus') return true
              return false
            }),
            configurable: true
          })
          
          // Dispatch focus events synchronously
          const focusEvent = new Event('focus', { bubbles: true })
          inputElement.dispatchEvent(focusEvent)
          
          const focusinEvent = new Event('focusin', { bubbles: true })
          inputElement.dispatchEvent(focusinEvent)
        }),
        configurable: true,
        writable: true
      })
      
      // Also handle blur for completeness
      Object.defineProperty(element, 'blur', {
        value: vi.fn().mockImplementation(function(this: HTMLElement) {
          const inputElement = this
          
          if (currentFocusedElement === inputElement) {
            currentFocusedElement = null
            
            // Update activeElement to body
            Object.defineProperty(document, 'activeElement', {
              get: () => document.body,
              configurable: true
            })
          }
          
          Object.defineProperty(inputElement, 'matches', {
            value: vi.fn((selector: string) => selector !== ':focus'),
            configurable: true
          })
          
          const blurEvent = new Event('blur', { bubbles: true })
          inputElement.dispatchEvent(blurEvent)
        }),
        configurable: true,
        writable: true
      })
    }
    
    // Add click mock for interactive elements
    if (tagName === 'a' || tagName === 'button' || tagName === 'input') {
      Object.defineProperty(element, 'click', {
        value: vi.fn(),
        configurable: true,
        writable: true
      })
    }
    
    // Additional methods for textarea
    if (tagName === 'textarea') {
      Object.defineProperty(element, 'select', {
        value: vi.fn(),
        configurable: true,
        writable: true
      })
      Object.defineProperty(element, 'setSelectionRange', {
        value: vi.fn(),
        configurable: true,
        writable: true
      })
    }
    
    return element
  })
  
  // Wait for setup to complete
  await new Promise(resolve => setTimeout(resolve, 0))
})