/**
 * Frontend Test Timeout Fix - Comprehensive Solution
 * 
 * This file addresses the critical timeout issues in frontend tests by providing:
 * 1. Standardized timeout configurations across all test files
 * 2. Proper fake timer management for React 19
 * 3. Simplified async utilities that prevent infinite loops
 * 4. Performance overhead reduction
 */

import { vi } from 'vitest'
import { waitFor } from '@testing-library/react'

// ============================================================================
// TIMEOUT CONFIGURATION CONSTANTS
// ============================================================================

export const TIMEOUT_CONFIG = {
  // Standard test timeouts (milliseconds) - MUST match vitest.config.ts
  TEST_TIMEOUT: 8000,
  HOOK_TIMEOUT: 5000,
  TEARDOWN_TIMEOUT: 3000,
  WAITFOR_TIMEOUT: 5000,
  
  // React 19 specific intervals
  REACT19_UPDATE_INTERVAL: 16, // 60fps
  REACT19_BATCHING_DELAY: 0,   // Concurrent mode batching
  
  // Performance thresholds
  SLOW_TEST_THRESHOLD: 1000,   // 1 second
  CRITICAL_TEST_THRESHOLD: 5000, // 5 seconds
} as const

// ============================================================================
// FAKE TIMER UTILITIES - PREVENT HANGING
// ============================================================================

/**
 * Safely set up fake timers with consistent configuration
 * Prevents timer-related hanging issues
 */
export function setupFakeTimers(): void {
  // Ensure clean state - critical for preventing conflicts
  vi.useRealTimers()
  
  // Configure fake timers with React 19 compatibility
  vi.useFakeTimers({
    shouldAdvanceTime: false, // Manual control to prevent infinite loops
    toFake: [
      'setTimeout',
      'clearTimeout', 
      'setInterval',
      'clearInterval',
      'Date'
    ]
  })
}

/**
 * Safely advance timers by specified amount
 * Includes fallback to prevent hanging
 */
export async function advanceTimersSafely(ms: number): Promise<void> {
  try {
    await vi.advanceTimersByTimeAsync(ms)
  } catch (error) {
    console.warn(`Timer advancement failed: ${error}`)
    // Fallback to real time advancement with timeout protection
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, Math.min(ms, 100))),
      new Promise(resolve => setTimeout(resolve, 1000)) // Max 1s fallback
    ])
  }
}

/**
 * Clean up fake timers safely - critical for test isolation
 */
export function cleanupFakeTimers(): void {
  try {
    vi.clearAllTimers()
    vi.useRealTimers()
  } catch (error) {
    console.warn(`Timer cleanup failed: ${error}`)
    // Force cleanup
    try {
      vi.useRealTimers()
    } catch (e) {
      // Last resort - ignore errors
    }
  }
}

// ============================================================================
// SIMPLIFIED WAITFOR UTILITIES - NO INFINITE LOOPS
// ============================================================================

/**
 * Simplified waitFor that prevents infinite loops and respects timeouts
 * This replaces the complex async-timeout-utils.ts functions
 */
export async function waitForSimple<T>(
  callback: () => T | Promise<T>,
  options: {
    timeout?: number,
    interval?: number,
    maxRetries?: number
  } = {}
): Promise<T> {
  const {
    timeout = TIMEOUT_CONFIG.WAITFOR_TIMEOUT,
    interval = TIMEOUT_CONFIG.REACT19_UPDATE_INTERVAL,
    maxRetries = 3
  } = options
  
  const startTime = Date.now()
  let lastError: Error | undefined
  let retryCount = 0
  
  while (Date.now() - startTime < timeout && retryCount <= maxRetries) {
    try {
      const result = await callback()
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if we should continue retrying
      if (Date.now() - startTime + interval >= timeout) {
        break
      }
      
      // Wait before next attempt - use Promise.race for timeout protection
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, interval)),
        new Promise(resolve => setTimeout(resolve, timeout)) // Safety timeout
      ])
      retryCount++
    }
  }
  
  // If we get here, all attempts failed
  throw new Error(
    `waitForSimple timed out after ${timeout}ms (${retryCount} retries). ` +
    `Last error: ${lastError?.message || 'Unknown error'}`
  )
}

/**
 * Wait for React component to render with timeout protection
 * Uses standard @testing-library/react waitFor
 */
export async function waitForComponentRender(
  selector: () => Element | null,
  timeout: number = TIMEOUT_CONFIG.WAITFOR_TIMEOUT
): Promise<Element> {
  return waitFor(() => {
    const element = selector()
    if (!element) {
      throw new Error('Component not found')
    }
    return element
  }, { 
    timeout,
    interval: TIMEOUT_CONFIG.REACT19_UPDATE_INTERVAL
  })
}

/**
 * Wait for async state update with React 19 batching consideration
 * Uses standard @testing-library/react waitFor
 */
export async function waitForStateUpdate<T>(
  getter: () => T,
  expectedValue: T,
  timeout: number = TIMEOUT_CONFIG.WAITFOR_TIMEOUT
): Promise<T> {
  return waitFor(() => {
    const currentValue = getter()
    if (currentValue !== expectedValue) {
      throw new Error(`State not updated. Expected: ${expectedValue}, Got: ${currentValue}`)
    }
    return currentValue
  }, { 
    timeout,
    interval: TIMEOUT_CONFIG.REACT19_UPDATE_INTERVAL 
  })
}

// ============================================================================
// TEST ENVIRONMENT FIXES
// ============================================================================

/**
 * Fix React 19 test environment setup - minimal and safe
 */
export function setupReact19Environment(): void {
  // Ensure React DevTools compatibility
  if (typeof window !== 'undefined') {
    ;(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      isDisabled: false,
      supportsFiber: true,
      supportsConc: true,
      inject: () => {},
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
    }
  }
  
  // Configure React 19 testing library settings - use standard values
  if (typeof global !== 'undefined') {
    try {
      const { configure } = require('@testing-library/react')
      configure({
        asyncUtilTimeout: TIMEOUT_CONFIG.WAITFOR_TIMEOUT,
        testIdAttribute: 'data-testid',
        defaultHidden: true
      })
    } catch (error) {
      console.warn('Could not configure React Testing Library:', error)
    }
  }
}

/**
 * Clean up React 19 test environment - minimal and safe
 */
export function cleanupReact19Environment(): void {
  // Remove test containers
  if (typeof document !== 'undefined') {
    try {
      const testContainers = document.querySelectorAll('[data-testid="test-container"]')
      testContainers.forEach(container => container.remove())
    } catch (error) {
      console.warn('Could not clean up test containers:', error)
    }
  }
  
  // Clean up any React 19 specific state
  cleanupFakeTimers()
}

// ============================================================================
// TIMEOUT DETECTION AND REPORTING
// ============================================================================

/**
 * Create a timeout-aware test wrapper for debugging
 */
export function withTimeoutDetection<T extends (...args: any[]) => any>(
  testFn: T,
  name: string = 'unnamed test'
): T {
  return ((...args: Parameters<T>) => {
    const startTime = Date.now()
    
    // Set up timeout warnings
    const timeoutWarning = setTimeout(() => {
      console.warn(`⚠️ Test "${name}" has been running for ${TIMEOUT_CONFIG.SLOW_TEST_THRESHOLD}ms`)
    }, TIMEOUT_CONFIG.SLOW_TEST_THRESHOLD)
    
    const timeoutError = setTimeout(() => {
      console.error(`❌ Test "${name}" exceeded critical threshold of ${TIMEOUT_CONFIG.CRITICAL_TEST_THRESHOLD}ms`)
    }, TIMEOUT_CONFIG.CRITICAL_TEST_THRESHOLD)
    
    const cleanup = () => {
      clearTimeout(timeoutWarning)
      clearTimeout(timeoutError)
      
      const duration = Date.now() - startTime
      if (duration > TIMEOUT_CONFIG.SLOW_TEST_THRESHOLD) {
        console.warn(`🐌 Slow test "${name}": ${duration}ms`)
      }
    }
    
    try {
      const result = testFn(...args)
      
      // If it's a promise, add timeout tracking
      if (result && typeof result.then === 'function') {
        return result.finally(cleanup)
      }
      
      // Synchronous test
      cleanup()
      return result
    } catch (error) {
      cleanup()
      throw error
    }
  }) as T
}

// ============================================================================
// VITEST TIMEOUT OVERRIDE FIX
// ============================================================================

/**
 * Disable the problematic timeout overrides from setup files
 * Call this to prevent conflicts with vitest.config.ts timeouts
 */
export function disableTimeoutOverrides(): void {
  // Prevent async-timeout-utils from overriding vitest timeouts
  if (typeof vi !== 'undefined' && vi.setConfig) {
    // Reset to default configuration from vitest.config.ts
    try {
      vi.setConfig({ 
        testTimeout: TIMEOUT_CONFIG.TEST_TIMEOUT,
        hookTimeout: TIMEOUT_CONFIG.HOOK_TIMEOUT
      })
    } catch (error) {
      console.warn('Could not reset vitest config:', error)
    }
  }
}

/**
 * Simple setup function that doesn't override timeouts
 */
export function setupSimpleTestEnvironment(): void {
  setupReact19Environment()
  disableTimeoutOverrides()
}

/**
 * Simple cleanup function
 */
export function cleanupSimpleTestEnvironment(): void {
  cleanupReact19Environment()
}

// ============================================================================
// EXPORTS FOR COMMON USE CASES
// ============================================================================

export {
  TIMEOUT_CONFIG as default,
  setupFakeTimers,
  advanceTimersSafely,
  cleanupFakeTimers,
  waitForSimple,
  waitForComponentRender,
  waitForStateUpdate,
  setupReact19Environment,
  cleanupReact19Environment,
  withTimeoutDetection,
  setupSimpleTestEnvironment,
  cleanupSimpleTestEnvironment,
  disableTimeoutOverrides
}

// ============================================================================
// AUTOMATIC SETUP (if enabled)
// ============================================================================

// Auto-setup React 19 environment if this file is imported in minimal mode
if (process.env.VITEST_MINIMAL_MODE === 'true') {
  setupSimpleTestEnvironment()
  console.log('🔧 Simple timeout configuration loaded for minimal mode')
}

// Log timeout configuration for debugging
if (process.env.DEBUG_TIMEOUTS === 'true') {
  console.log('🔧 Timeout configuration loaded:', TIMEOUT_CONFIG)
}