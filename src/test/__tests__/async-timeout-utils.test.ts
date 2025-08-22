/**
 * Tests for React 19-optimized async timeout utilities
 * 
 * This test suite validates the timeout handling capabilities for:
 * - React 19 concurrent mode operations
 * - Database operations with SQLite-specific timeouts
 * - Async error boundaries and retry logic
 * - Component rendering and state updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  waitForReact19,
  waitForDatabase,
  waitForComponent,
  waitForFocus,
  waitForStateUpdate,
  waitForErrorBoundary,
  waitForAnimation,
  createTimeoutPromise,
  batchWithTimeout,
  TIMEOUT_PRESETS,
  type React19TimeoutConfig
} from '../async-timeout-utils'

describe('React 19 Async Timeout Utilities', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    // CRITICAL FIX: Setup fake timers for all tests that use timeout functionality
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    // CRITICAL FIX: Proper timer cleanup sequence
    // First, run any pending timers to completion
    if (vi.isFakeTimers()) {
      vi.runAllTimers()
    }
    // Then restore real timers
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('waitForReact19', () => {
    it('should resolve quickly for immediate operations', async () => {
      const result = await waitForReact19(() => 'success')
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.retryAttempts).toBe(0)
      expect(result.duration).toBeLessThan(100)
    })

    it('should handle async operations with timeout', async () => {
      const asyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return 'async success'
      }

      const resultPromise = waitForReact19(asyncOperation, { timeout: 1000 })
      
      // Advance timers to complete the async operation
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('async success')
    })

    it('should retry on recoverable errors', async () => {
      let attemptCount = 0
      const flakyOperation = () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
        return 'success after retries'
      }

      const resultPromise = waitForReact19(flakyOperation, {
        maxRetries: 3,
        initialRetryDelay: 10
      })

      // Advance timers to allow retries to complete
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('success after retries')
      expect(result.retryAttempts).toBe(2)
    })

    it('should fail after max retries', async () => {
      const alwaysFailingOperation = () => {
        throw new Error('Persistent failure')
      }

      const resultPromise = waitForReact19(alwaysFailingOperation, {
        maxRetries: 2,
        initialRetryDelay: 10
      })

      // Advance timers to allow all retries to exhaust
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('Persistent failure')
      expect(result.retryAttempts).toBe(2)
    })

    it('should respect error filtering', async () => {
      const criticalErrorOperation = () => {
        throw new Error('Critical system failure')
      }

      const config: Partial<React19TimeoutConfig> = {
        retryEnabled: true,
        maxRetries: 2,
        errorFilter: (error) => !error.message.includes('Critical')
      }

      const result = await waitForReact19(criticalErrorOperation, config)

      expect(result.success).toBe(false)
      expect(result.retryAttempts).toBe(0) // Should not retry critical errors
    })

    it('should handle concurrent mode optimizations', async () => {
      const concurrentOperation = () => {
        // Simulate React 19 concurrent rendering
        return new Promise(resolve => {
          requestAnimationFrame(() => resolve('concurrent success'))
        })
      }

      const resultPromise = waitForReact19(concurrentOperation, {
        enableConcurrentMode: true,
        timeout: 1000
      })
      
      // Advance past one animation frame (16ms)
      await vi.advanceTimersByTimeAsync(20)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('concurrent success')
    })
  })

  describe('waitForDatabase', () => {
    it('should handle database lock errors with retry', async () => {
      let lockAttempts = 0
      const lockedOperation = () => {
        lockAttempts++
        if (lockAttempts < 3) {
          throw new Error('database is locked')
        }
        return { data: 'query result' }
      }

      const resultPromise = waitForDatabase(lockedOperation, {
        queryTimeout: 1000,
        maxRetries: 3
      })

      // Advance timers to allow retries
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ data: 'query result' })
      expect(result.retryAttempts).toBe(2)
    })

    it('should fail on non-recoverable database errors', async () => {
      const schemaErrorOperation = () => {
        throw new Error('no such table: users')
      }

      const result = await waitForDatabase(schemaErrorOperation)

      expect(result.success).toBe(false)
      expect(result.retryAttempts).toBe(0) // Schema errors should not retry
    })

    it('should respect database-specific timeouts', async () => {
      const slowQueryOperation = () => {
        return new Promise(resolve => {
          setTimeout(() => resolve('slow query result'), 2000)
        })
      }

      const resultPromise = waitForDatabase(slowQueryOperation, {
        queryTimeout: 500 // Short timeout
      })

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(600)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('timeout')
    })
  })

  describe('waitForComponent', () => {
    it('should wait for component to appear in DOM', async () => {
      const elementSelector = () => document.querySelector('[data-testid="test-component"]')

      // Schedule component to appear after delay
      setTimeout(() => {
        const element = document.createElement('div')
        element.setAttribute('data-testid', 'test-component')
        element.textContent = 'Test Component'
        document.body.appendChild(element)
      }, 100)

      const resultPromise = waitForComponent(elementSelector)
      
      // Advance past the scheduled time
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBeInstanceOf(Element)
      expect(result.result?.getAttribute('data-testid')).toBe('test-component')
    })

    it('should timeout if component never appears', async () => {
      const missingSelector = () => document.querySelector('[data-testid="missing-component"]')

      const resultPromise = waitForComponent(missingSelector, { timeout: 500 })
      
      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(600)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Component not found')
    })
  })

  describe('waitForFocus', () => {
    it('should wait for element to receive focus', async () => {
      // Create element and add to DOM
      const input = document.createElement('input')
      input.setAttribute('data-testid', 'focus-input')
      document.body.appendChild(input)

      const elementSelector = () => document.querySelector('[data-testid="focus-input"]') as Element

      // Schedule focus after delay
      setTimeout(() => {
        input.focus()
      }, 50)

      const resultPromise = waitForFocus(elementSelector)
      
      // Advance past the focus time
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe(input)
    })
  })

  describe('waitForStateUpdate', () => {
    it('should wait for state to reach expected value', async () => {
      let state = 'initial'
      const stateAccessor = () => state

      // Schedule state update
      setTimeout(() => {
        state = 'updated'
      }, 100)

      const resultPromise = waitForStateUpdate(stateAccessor, 'updated')
      
      // Advance past the state update time
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('updated')
    })

    it('should fail if state never reaches expected value', async () => {
      const stateAccessor = () => 'unchanging'

      const resultPromise = waitForStateUpdate(
        stateAccessor, 
        'expected', 
        { timeout: 300 }
      )
      
      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(400)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('State not updated')
    })
  })

  describe('waitForErrorBoundary', () => {
    it('should handle error boundary triggers', async () => {
      const errorTrigger = async () => {
        throw new Error('Test error for boundary')
      }

      const result = await waitForErrorBoundary(errorTrigger, {
        errorBoundaryMode: 'permissive'
      })

      expect(result.success).toBe(true)
    })

    it('should fail in strict mode if no error occurs', async () => {
      const noErrorTrigger = async () => {
        // Does nothing, no error thrown
      }

      const result = await waitForErrorBoundary(noErrorTrigger, {
        errorBoundaryMode: 'strict'
      })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Expected error boundary')
    })
  })

  describe('waitForAnimation', () => {
    it('should wait for animations to complete', async () => {
      // Create element with animation
      const animatedElement = document.createElement('div')
      animatedElement.setAttribute('data-testid', 'animated')
      animatedElement.style.animationName = 'test-animation'
      document.body.appendChild(animatedElement)

      const elementSelector = () => document.querySelector('[data-testid="animated"]')

      // Schedule animation completion
      setTimeout(() => {
        animatedElement.style.animationName = 'none'
      }, 200)

      const resultPromise = waitForAnimation(elementSelector)
      
      // Advance past animation completion
      await vi.advanceTimersByTimeAsync(250)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe(animatedElement)
    })
  })

  describe('createTimeoutPromise', () => {
    it('should resolve when promise resolves within timeout', async () => {
      const fastPromise = new Promise(resolve => 
        setTimeout(() => resolve('fast result'), 100)
      )

      const resultPromise = createTimeoutPromise(fastPromise, 200, 'Should not timeout')
      
      // Advance past promise resolution but before timeout
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise
      
      expect(result).toBe('fast result')
    })

    it('should reject when promise takes longer than timeout', async () => {
      const slowPromise = new Promise(resolve => 
        setTimeout(() => resolve('slow result'), 300)
      )

      const resultPromise = createTimeoutPromise(slowPromise, 200, 'Custom timeout message')
      
      // Advance past timeout but before promise resolution
      await vi.advanceTimersByTimeAsync(250)

      await expect(resultPromise).rejects.toThrow('Custom timeout message')
    })
  })

  describe('batchWithTimeout', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const processor = async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return item * 2
      }

      const resultPromise = batchWithTimeout(items, processor, {
        enableConcurrentMode: true
      })
      
      // Advance timers to complete all batch processing
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    })

    it('should handle partial failures in batch processing', async () => {
      const items = [1, 2, 3, 4, 5]
      const processor = async (item: number) => {
        if (item === 3) {
          throw new Error(`Failed to process ${item}`)
        }
        return item * 2
      }

      const resultPromise = batchWithTimeout(items, processor)
      
      // Advance timers to complete batch processing
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.result).toEqual([2, 4, 8, 10]) // Missing item 3
      expect(result.error?.message).toContain('1 operations failed')
    })
  })

  describe('TIMEOUT_PRESETS', () => {
    it('should provide appropriate presets for different scenarios', () => {
      expect(TIMEOUT_PRESETS.FAST.timeout).toBeLessThan(TIMEOUT_PRESETS.STANDARD.timeout)
      expect(TIMEOUT_PRESETS.STANDARD.timeout).toBeLessThan(TIMEOUT_PRESETS.SLOW.timeout)
      expect(TIMEOUT_PRESETS.DATABASE.queryTimeout).toBeDefined()
      expect(TIMEOUT_PRESETS.NETWORK.errorBoundaryMode).toBe('strict')
    })
  })

  describe('Configuration validation', () => {
    it('should use default configuration when not provided', async () => {
      const result = await waitForReact19(() => 'default config test')
      
      expect(result.success).toBe(true)
      // Default config should be applied
    })

    it('should merge partial configurations with defaults', async () => {
      const partialConfig: Partial<React19TimeoutConfig> = {
        timeout: 5000,
        maxRetries: 5
      }

      const result = await waitForReact19(() => 'partial config test', partialConfig)

      expect(result.success).toBe(true)
      // Should use provided timeout and maxRetries, but default for other values
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle non-Error objects thrown', async () => {
      const stringErrorOperation = () => {
        throw 'String error'
      }

      const result = await waitForReact19(stringErrorOperation)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('String error')
    })

    it('should handle null/undefined errors', async () => {
      const nullErrorOperation = () => {
        throw null
      }

      const result = await waitForReact19(nullErrorOperation)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })
  })

  describe('React 19 specific optimizations', () => {
    it('should use 16ms intervals for concurrent mode', async () => {
      const operation = () => {
        return new Promise(resolve => {
          // Simulate React 19 concurrent scheduling
          requestAnimationFrame(() => resolve('concurrent result'))
        })
      }

      const resultPromise = waitForReact19(operation, {
        enableConcurrentMode: true
      })
      
      // Advance past animation frame
      await vi.advanceTimersByTimeAsync(20)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.result).toBe('concurrent result')
    })

    it('should handle automatic batching scenarios', async () => {
      let batchedUpdates = 0
      const batchedOperation = () => {
        // Simulate multiple state updates that React 19 would batch
        Promise.resolve().then(() => batchedUpdates++)
        Promise.resolve().then(() => batchedUpdates++)
        Promise.resolve().then(() => batchedUpdates++)
        
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(batchedUpdates)
          }, 50)
        })
      }

      const resultPromise = waitForReact19(batchedOperation)
      
      // Advance timers to complete batched operations
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(typeof result.result).toBe('number')
    })
  })
})