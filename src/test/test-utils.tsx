import { render as rtlRender, RenderOptions, waitFor } from '@testing-library/react'
import { ReactElement, Suspense } from 'react'
import { 
  waitForReact19, 
  waitForComponent, 
  waitForFocus, 
  waitForStateUpdate,
  TIMEOUT_PRESETS,
  type React19TimeoutConfig,
  type TimeoutResult 
} from './async-timeout-utils'

// ============================================================================
// ENHANCED RENDER UTILITIES
// ============================================================================

// Custom render function that renders into document.body by default
// Optimized for React 19 concurrent features
function render(
  ui: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof rtlRender> {
  // Create a new container for each render to avoid conflicts
  const container = document.createElement('div')
  container.setAttribute('data-testid', 'test-container')
  document.body.appendChild(container)
  
  // Enhanced render options for React 19 compatibility
  // FE-002: Remove legacyRoot configuration (React 19 uses concurrent mode by default)
  const renderOptions: RenderOptions = {
    container,
    ...options,
  }
  
  return rtlRender(ui, renderOptions)
}

// FE-006: Add Suspense test utilities for React 19 compatibility
function renderWithSuspense(
  ui: ReactElement,
  fallback?: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof rtlRender> {
  const suspenseFallback = fallback || <div data-testid="suspense-fallback">Loading...</div>
  
  const wrappedComponent = (
    <Suspense fallback={suspenseFallback}>
      {ui}
    </Suspense>
  )
  
  return render(wrappedComponent, options)
}

// ============================================================================
// REACT 19-OPTIMIZED WAITING UTILITIES
// ============================================================================

/**
 * Enhanced waitFor with React 19 optimizations and automatic retry
 */
async function waitForReact19Enhanced<T>(
  callback: () => T | Promise<T>,
  options: Partial<React19TimeoutConfig> = {}
): Promise<T> {
  const result = await waitForReact19(callback, {
    ...TIMEOUT_PRESETS.STANDARD,
    ...options
  })
  
  if (!result.success) {
    throw result.error || new Error('waitForReact19Enhanced failed')
  }
  
  return result.result
}

/**
 * Utility to wait for Suspense boundaries to resolve with enhanced timeout handling
 */
async function waitForSuspense(
  timeout: number = TIMEOUT_PRESETS.STANDARD.timeout
): Promise<TimeoutResult<void>> {
  return waitForReact19(async () => {
    // React 19 handles Suspense resolution automatically with concurrent features
    // This utility provides a consistent way to wait for async components
    await new Promise(resolve => setTimeout(resolve, 0))
  }, { timeout })
}

/**
 * Wait for element to be present in DOM with React 19 optimizations
 */
async function waitForElement(
  selector: string | (() => Element | null),
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  const elementSelector = typeof selector === 'string' 
    ? () => document.querySelector(selector)
    : selector
  
  const result = await waitForComponent(elementSelector, options)
  
  if (!result.success) {
    throw result.error || new Error(`Element not found: ${selector}`)
  }
  
  return result.result
}

/**
 * Wait for element to have focus with enhanced timeout handling
 */
async function waitForElementFocus(
  selector: string | (() => Element | null),
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  const elementSelector = typeof selector === 'string' 
    ? () => document.querySelector(selector)
    : selector
  
  const result = await waitForFocus(elementSelector, options)
  
  if (!result.success) {
    throw result.error || new Error(`Element not focused: ${selector}`)
  }
  
  return result.result
}

/**
 * Wait for text content to appear with retry logic
 */
async function waitForText(
  text: string,
  container?: Element,
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  return waitForReact19Enhanced(() => {
    const searchContainer = container || document.body
    const element = Array.from(searchContainer.querySelectorAll('*')).find(
      el => el.textContent?.includes(text)
    )
    
    if (!element) {
      throw new Error(`Text not found: ${text}`)
    }
    
    return element
  }, options)
}

/**
 * Wait for specific CSS class to be applied
 */
async function waitForClass(
  element: Element | (() => Element | null),
  className: string,
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  const elementGetter = typeof element === 'function' ? element : () => element
  
  return waitForReact19Enhanced(() => {
    const el = elementGetter()
    if (!el) {
      throw new Error('Element not found')
    }
    
    if (!el.classList.contains(className)) {
      throw new Error(`Class not found: ${className}`)
    }
    
    return el
  }, options)
}

/**
 * Wait for attribute to have specific value
 */
async function waitForAttribute(
  element: Element | (() => Element | null),
  attributeName: string,
  expectedValue: string,
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  const elementGetter = typeof element === 'function' ? element : () => element
  
  return waitForReact19Enhanced(() => {
    const el = elementGetter()
    if (!el) {
      throw new Error('Element not found')
    }
    
    const actualValue = el.getAttribute(attributeName)
    if (actualValue !== expectedValue) {
      throw new Error(
        `Attribute ${attributeName} has value "${actualValue}", expected "${expectedValue}"`
      )
    }
    
    return el
  }, options)
}

/**
 * Wait for element to become visible (not display: none or visibility: hidden)
 */
async function waitForVisible(
  element: Element | (() => Element | null),
  options: Partial<React19TimeoutConfig> = {}
): Promise<Element> {
  const elementGetter = typeof element === 'function' ? element : () => element
  
  return waitForReact19Enhanced(() => {
    const el = elementGetter()
    if (!el) {
      throw new Error('Element not found')
    }
    
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') {
      throw new Error('Element is not visible')
    }
    
    return el
  }, options)
}

/**
 * Wait for promise to resolve with timeout protection
 */
async function waitForPromise<T>(
  promiseFactory: () => Promise<T>,
  options: Partial<React19TimeoutConfig> = {}
): Promise<T> {
  return waitForReact19Enhanced(promiseFactory, options)
}

/**
 * Wait for callback to return truthy value
 */
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  errorMessage: string = 'Condition not met',
  options: Partial<React19TimeoutConfig> = {}
): Promise<void> {
  return waitForReact19Enhanced(async () => {
    const result = await condition()
    if (!result) {
      throw new Error(errorMessage)
    }
  }, options)
}

/**
 * Wait for mock function to be called with specific arguments
 */
async function waitForMockCall(
  mockFn: jest.Mock | vi.Mock,
  expectedArgs?: any[],
  options: Partial<React19TimeoutConfig> = {}
): Promise<void> {
  return waitForReact19Enhanced(() => {
    if (mockFn.mock.calls.length === 0) {
      throw new Error('Mock function was not called')
    }
    
    if (expectedArgs) {
      const matchingCall = mockFn.mock.calls.find(call => 
        expectedArgs.every((arg, index) => 
          JSON.stringify(call[index]) === JSON.stringify(arg)
        )
      )
      
      if (!matchingCall) {
        throw new Error(
          `Mock function was not called with expected arguments: ${JSON.stringify(expectedArgs)}`
        )
      }
    }
  }, options)
}

/**
 * Enhanced waitFor that integrates with our timeout utilities
 */
async function waitForEnhanced<T>(
  callback: () => T | Promise<T>,
  options: Partial<React19TimeoutConfig> = {}
): Promise<T> {
  // Use standard @testing-library/react waitFor but with our timeout configuration
  const config = { ...TIMEOUT_PRESETS.STANDARD, ...options }
  
  return waitFor(callback, {
    timeout: config.timeout,
    interval: config.enableConcurrentMode ? 16 : 50,
  })
}

// ============================================================================
// CLEANUP AND SETUP UTILITIES
// ============================================================================

/**
 * Setup test environment with React 19 optimizations
 */
function setupReact19TestEnvironment() {
  // Configure React 19-specific test environment settings
  if (typeof window !== 'undefined') {
    // Ensure React DevTools detects React 19
    ;(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      isDisabled: false,
      supportsFiber: true,
      supportsConc: true, // React 19 concurrent features
      inject: () => {},
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
    }
  }
}

/**
 * Cleanup after React 19 tests
 */
function cleanupReact19TestEnvironment() {
  // Clean up any React 19-specific test state
  if (typeof document !== 'undefined') {
    // Remove all test containers
    const testContainers = document.querySelectorAll('[data-testid="test-container"]')
    testContainers.forEach(container => container.remove())
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export everything from testing-library/react
export * from '@testing-library/react'

// Export our enhanced utilities
export { 
  render, 
  renderWithSuspense, 
  waitForSuspense,
  waitForElement,
  waitForElementFocus,
  waitForText,
  waitForClass,
  waitForAttribute,
  waitForVisible,
  waitForPromise,
  waitForCondition,
  waitForMockCall,
  waitForEnhanced,
  waitForReact19Enhanced,
  setupReact19TestEnvironment,
  cleanupReact19TestEnvironment
}

// Export timeout utilities
export {
  waitForReact19,
  waitForComponent,
  waitForFocus,
  waitForStateUpdate,
  TIMEOUT_PRESETS,
  type React19TimeoutConfig,
  type TimeoutResult
} from './async-timeout-utils'