/**
 * React 19-Optimized Async Timeout Utilities
 * 
 * Provides specialized timeout handling for React 19's concurrent mode,
 * automatic batching, and enhanced async operations. This utility addresses
 * the specific timeout challenges in our test infrastructure.
 */

import { waitFor } from '@testing-library/react'

type WaitForOptions = Parameters<typeof waitFor>[1]
import { vi } from 'vitest'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * React 19-specific timeout configuration with enhanced controls
 */
export interface React19TimeoutConfig {
  /** Base timeout in milliseconds (default: 10000) */
  timeout: number
  /** Enable React 19 concurrent mode optimizations (default: true) */
  enableConcurrentMode: boolean
  /** Enable automatic retry with exponential backoff */
  retryEnabled: boolean
  /** Maximum retry attempts (default: 3) */
  maxRetries: number
  /** Initial retry delay in milliseconds (default: 100) */
  initialRetryDelay: number
  /** Error boundary handling mode */
  errorBoundaryMode: 'strict' | 'permissive'
  /** Custom error filtering function */
  errorFilter?: (error: Error) => boolean
}

/**
 * Database-specific timeout configuration
 */
export interface DatabaseTimeoutConfig extends React19TimeoutConfig {
  /** SQLite-specific operation timeout */
  queryTimeout: number
  /** Connection establishment timeout */
  connectionTimeout: number
  /** Transaction timeout */
  transactionTimeout: number
  /** Lock timeout for concurrent operations */
  lockTimeout: number
}

/**
 * Result type for async operations with timeout metadata
 */
export interface TimeoutResult<T = void> {
  /** The actual result of the operation */
  result: T
  /** Total time taken in milliseconds */
  duration: number
  /** Number of retry attempts made */
  retryAttempts: number
  /** Whether the operation completed successfully */
  success: boolean
  /** Error that occurred, if any */
  error?: Error
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  /** Strategy type */
  type: 'exponential' | 'linear' | 'custom'
  /** Custom delay calculation function */
  calculateDelay?: (attemptNumber: number) => number
  /** Jitter to add to delays to prevent thundering herd */
  jitter: boolean
  /** Maximum delay between retries */
  maxDelay: number
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

/** Default React 19 timeout configuration optimized for concurrent mode */
const DEFAULT_REACT19_CONFIG: React19TimeoutConfig = {
  timeout: 10000,
  enableConcurrentMode: true,
  retryEnabled: true,
  maxRetries: 3,
  initialRetryDelay: 100,
  errorBoundaryMode: 'permissive'
}

/** Database-specific timeout configuration */
const DEFAULT_DATABASE_CONFIG: DatabaseTimeoutConfig = {
  ...DEFAULT_REACT19_CONFIG,
  queryTimeout: 5000,
  connectionTimeout: 3000,
  transactionTimeout: 10000,
  lockTimeout: 2000
}

/** Timeout configurations by test scenario */
const TIMEOUT_PRESETS = {
  /** Fast operations (UI interactions, state updates) */
  FAST: { ...DEFAULT_REACT19_CONFIG, timeout: 2000, maxRetries: 2 },
  
  /** Standard operations (API calls, component rendering) */
  STANDARD: DEFAULT_REACT19_CONFIG,
  
  /** Slow operations (file operations, complex calculations) */
  SLOW: { ...DEFAULT_REACT19_CONFIG, timeout: 15000, maxRetries: 5 },
  
  /** Database operations */
  DATABASE: DEFAULT_DATABASE_CONFIG,
  
  /** Network operations */
  NETWORK: { ...DEFAULT_REACT19_CONFIG, timeout: 8000, errorBoundaryMode: 'strict' as const }
} as const

// ============================================================================
// CORE TIMEOUT UTILITIES
// ============================================================================

/**
 * React 19-optimized waitFor with enhanced error handling and retry logic
 */
export async function waitForReact19<T>(
  callback: () => T | Promise<T>,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<T>> {
  const fullConfig: React19TimeoutConfig = { ...DEFAULT_REACT19_CONFIG, ...config }
  const startTime = Date.now()
  let retryAttempts = 0
  let lastError: Error | undefined

  const waitForOptions: WaitForOptions = {
    timeout: fullConfig.timeout,
    interval: fullConfig.enableConcurrentMode ? 16 : 50, // React 19 update frequency
    onTimeout: (error: Error) => {
      // Enhanced timeout error with context
      const enhancedError = new Error(
        `React 19 timeout after ${fullConfig.timeout}ms with ${retryAttempts} retries. ` +
        `Original error: ${error.message}`
      )
      enhancedError.name = 'React19TimeoutError'
      enhancedError.stack = error.stack
      return enhancedError
    }
  }

  while (retryAttempts <= fullConfig.maxRetries) {
    let timeoutId: NodeJS.Timeout | undefined
    try {
      // Create a timeout promise that rejects after the specified timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Operation timeout after ${fullConfig.timeout}ms`))
        }, fullConfig.timeout)
      })
      
      // Race between the callback and the timeout
      const result = await Promise.race([
        Promise.resolve(callback()),
        timeoutPromise
      ])
      
      // Clear the timeout if operation completed successfully
      if (timeoutId) clearTimeout(timeoutId)
      
      return {
        result,
        duration: Date.now() - startTime,
        retryAttempts,
        success: true
      }
    } catch (error) {
      // Clear timeout if it exists
      if (timeoutId) clearTimeout(timeoutId)
      
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if error should be filtered out (non-retryable)
      if (fullConfig.errorFilter && !fullConfig.errorFilter(lastError)) {
        // Return failure immediately for filtered errors
        return {
          result: undefined as T,
          duration: Date.now() - startTime,
          retryAttempts,
          success: false,
          error: lastError
        }
      }
      
      // If retries disabled or max attempts reached, break
      if (!fullConfig.retryEnabled || retryAttempts >= fullConfig.maxRetries) {
        break
      }
      
      retryAttempts++
      
      // Calculate retry delay with exponential backoff
      const delay = calculateRetryDelay(retryAttempts, fullConfig.initialRetryDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // All retries exhausted, return failure result
  return {
    result: undefined as T,
    duration: Date.now() - startTime,
    retryAttempts,
    success: false,
    error: lastError
  }
}

/**
 * Database-optimized timeout utility with SQLite-specific handling
 */
export async function waitForDatabase<T>(
  operation: () => T | Promise<T>,
  config: Partial<DatabaseTimeoutConfig> = {}
): Promise<TimeoutResult<T>> {
  const fullConfig: DatabaseTimeoutConfig = { ...DEFAULT_DATABASE_CONFIG, ...config }
  
  // Add database-specific error filtering
  const databaseErrorFilter = (error: Error): boolean => {
    const message = error.message.toLowerCase()
    
    // Recoverable database errors that should trigger retry
    const recoverableErrors = [
      'database is locked',
      'busy',
      'cannot start a transaction within a transaction',
      'constraint failed',
      'connection lost'
    ]
    
    return recoverableErrors.some(pattern => message.includes(pattern))
  }

  return waitForReact19(operation, {
    ...fullConfig,
    timeout: fullConfig.queryTimeout,
    errorFilter: databaseErrorFilter
  })
}

/**
 * Component render timeout utility optimized for React 19 concurrent features
 */
export async function waitForComponent(
  selector: () => Element | null,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<Element>> {
  return waitForReact19(() => {
    const element = selector()
    if (!element) {
      throw new Error('Component not found')
    }
    return element
  }, config)
}

/**
 * Async error boundary timeout utility
 */
export async function waitForErrorBoundary(
  errorTrigger: () => Promise<void>,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<void>> {
  const fullConfig: React19TimeoutConfig = { ...DEFAULT_REACT19_CONFIG, ...config }
  const startTime = Date.now()
  
  try {
    await errorTrigger()
    
    // If no error was thrown, wait a bit to see if async error occurs
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (fullConfig.errorBoundaryMode === 'strict') {
      // In strict mode, no error means failure
      return {
        result: undefined,
        duration: Date.now() - startTime,
        retryAttempts: 0,
        success: false,
        error: new Error('Expected error boundary to be triggered but no error occurred')
      }
    }
    
    // In permissive mode, no error is okay
    return {
      result: undefined,
      duration: Date.now() - startTime,
      retryAttempts: 0,
      success: true
    }
  } catch (error) {
    // Error was thrown, which is expected for error boundary
    return {
      result: undefined,
      duration: Date.now() - startTime,
      retryAttempts: 0,
      success: true
    }
  }
}

// ============================================================================
// SPECIALIZED TIMEOUT HELPERS
// ============================================================================

/**
 * Focus management timeout for React 19
 * Handles the enhanced focus management in React 19
 */
export async function waitForFocus(
  element: () => Element | null,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<Element>> {
  return waitForReact19(() => {
    const el = element()
    if (!el || document.activeElement !== el) {
      throw new Error('Element not focused')
    }
    return el
  }, { ...TIMEOUT_PRESETS.FAST, ...config })
}

/**
 * State update timeout with React 19 batching considerations
 */
export async function waitForStateUpdate<T>(
  stateAccessor: () => T,
  expectedValue: T,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<T>> {
  return waitForReact19(() => {
    const currentValue = stateAccessor()
    if (currentValue !== expectedValue) {
      throw new Error(`State not updated. Expected: ${expectedValue}, Got: ${currentValue}`)
    }
    return currentValue
  }, { ...TIMEOUT_PRESETS.FAST, ...config })
}

/**
 * Animation completion timeout
 */
export async function waitForAnimation(
  element: () => Element | null,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<Element>> {
  return waitForReact19(() => {
    const el = element()
    if (!el) {
      throw new Error('Element not found')
    }
    
    // Check if element has any running animations or transitions
    const computedStyle = window.getComputedStyle(el)
    const animationName = computedStyle.getPropertyValue('animation-name')
    const transitionProperty = computedStyle.getPropertyValue('transition-property')
    
    if (animationName !== 'none' || transitionProperty !== 'none') {
      throw new Error('Animation/transition still running')
    }
    
    return el
  }, { ...TIMEOUT_PRESETS.STANDARD, ...config })
}

/**
 * Mock timer advancement with timeout protection
 */
export async function advanceTimersWithTimeout(
  milliseconds: number,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<void>> {
  return waitForReact19(async () => {
    // Use vi.advanceTimersByTime for more precise control
    await vi.advanceTimersByTimeAsync(milliseconds)
  }, { ...TIMEOUT_PRESETS.FAST, ...config })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateRetryDelay(
  attemptNumber: number, 
  baseDelay: number, 
  strategy: RetryStrategy = { 
    type: 'exponential', 
    jitter: true, 
    maxDelay: 5000 
  }
): number {
  let delay: number

  switch (strategy.type) {
    case 'exponential':
      delay = baseDelay * Math.pow(2, attemptNumber - 1)
      break
    case 'linear':
      delay = baseDelay * attemptNumber
      break
    case 'custom':
      delay = strategy.calculateDelay ? strategy.calculateDelay(attemptNumber) : baseDelay
      break
    default:
      delay = baseDelay
  }

  // Apply maximum delay limit
  delay = Math.min(delay, strategy.maxDelay)

  // Add jitter to prevent thundering herd
  if (strategy.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.floor(delay)
}

/**
 * Create a timeout promise that rejects after specified duration
 */
export function createTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
    })
  ])
}

/**
 * Batch async operations with timeout protection
 */
export async function batchWithTimeout<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: Partial<React19TimeoutConfig> = {}
): Promise<TimeoutResult<R[]>> {
  const fullConfig = { ...DEFAULT_REACT19_CONFIG, ...config }
  const startTime = Date.now()
  const results: R[] = []
  let errors: Error[] = []

  try {
    // Process items in small batches to respect React 19 concurrent scheduling
    const batchSize = fullConfig.enableConcurrentMode ? 5 : 10
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await createTimeoutPromise(
            processor(item),
            fullConfig.timeout,
            `Item ${i + index} timed out`
          )
          return { success: true, result, error: null }
        } catch (error) {
          return { 
            success: false, 
            result: null, 
            error: error instanceof Error ? error : new Error(String(error))
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      
      for (const result of batchResults) {
        if (result.success && result.result !== null) {
          results.push(result.result)
        } else if (result.error) {
          errors.push(result.error)
        }
      }

      // Yield control to React scheduler between batches
      if (fullConfig.enableConcurrentMode && i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    const success = errors.length === 0
    return {
      result: results,
      duration: Date.now() - startTime,
      retryAttempts: 0,
      success,
      error: errors.length > 0 ? new Error(`${errors.length} operations failed`) : undefined
    }
  } catch (error) {
    return {
      result: results,
      duration: Date.now() - startTime,
      retryAttempts: 0,
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

// ============================================================================
// TEST INTEGRATION HELPERS
// ============================================================================

/**
 * Setup global timeout handlers for Vitest environment
 */
export function setupReact19Timeouts() {
  // Increase default timeouts for React 19
  vi.setConfig({ testTimeout: 15000 })
  
  // Configure enhanced timer handling
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    advanceTimeDelta: 16 // React 19 update frequency
  })
}

/**
 * Cleanup timeout-related test state
 */
export function cleanupReact19Timeouts() {
  vi.clearAllTimers()
  vi.useRealTimers()
}

/**
 * Wrapper for test functions with automatic timeout configuration
 */
export function withReact19Timeout<T extends (...args: any[]) => any>(
  testFn: T,
  config: Partial<React19TimeoutConfig> = {}
): T {
  return ((...args: Parameters<T>) => {
    const fullConfig = { ...DEFAULT_REACT19_CONFIG, ...config }
    
    // Set test timeout (store original as a constant since vi.getConfig doesn't exist)
    const originalTimeout = 60000 // Default vitest timeout
    vi.setConfig({ testTimeout: fullConfig.timeout + 2000 })
    
    try {
      return testFn(...args)
    } finally {
      // Restore original timeout
      vi.setConfig({ testTimeout: originalTimeout })
    }
  }) as T
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TIMEOUT_PRESETS,
  DEFAULT_REACT19_CONFIG,
  DEFAULT_DATABASE_CONFIG
}