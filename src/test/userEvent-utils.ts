/**
 * UserEvent Utility for React 19 and Vitest
 * 
 * Handles the complex interaction between userEvent and fake timers
 * to prevent test timeouts and ensure proper isolation.
 * 
 * Key patterns:
 * - Use setupUser() when NOT using fake timers
 * - Use setupUserWithFakeTimers() when using fake timers
 * - Always clean up properly in afterEach
 */

import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

/**
 * Sets up userEvent without fake timers.
 * Use this for most tests that don't need timer control.
 */
export async function setupUser() {
  return userEvent.setup({
    pointerEventsCheck: 0,
    // No advanceTimers when using real timers
  })
}

/**
 * Sets up userEvent with fake timers support.
 * MUST be called AFTER vi.useFakeTimers()
 * 
 * @example
 * ```ts
 * beforeEach(async () => {
 *   vi.useFakeTimers()
 *   user = await setupUserWithFakeTimers()
 * })
 * ```
 */
export async function setupUserWithFakeTimers() {
  // Verify fake timers are active
  if (!vi.isFakeTimers()) {
    throw new Error('setupUserWithFakeTimers called but fake timers are not active. Call vi.useFakeTimers() first.')
  }
  
  return userEvent.setup({
    pointerEventsCheck: 0,
    advanceTimers: vi.advanceTimersByTime,
  })
}

/**
 * Properly cleans up fake timers to prevent test pollution.
 * Call this in afterEach when using fake timers.
 */
export function cleanupFakeTimers() {
  // First, run any pending timers to prevent hanging
  vi.runOnlyPendingTimers()
  // Then restore real timers
  vi.useRealTimers()
}

/**
 * Helper to conditionally set up userEvent based on timer state.
 * Automatically detects whether fake timers are active.
 * 
 * @deprecated Prefer explicit setupUser or setupUserWithFakeTimers
 */
export async function setupUserAuto() {
  if (vi.isFakeTimers()) {
    return setupUserWithFakeTimers()
  }
  return setupUser()
}

/**
 * Complete test setup helper that includes timer management.
 * Returns both user instance and cleanup function.
 * 
 * @example
 * ```ts
 * const { user, cleanup } = await setupTestEnvironment({ useFakeTimers: true })
 * // ... use user in tests
 * afterEach(cleanup)
 * ```
 */
export async function setupTestEnvironment(options: {
  useFakeTimers?: boolean
} = {}) {
  const { useFakeTimers = false } = options
  
  if (useFakeTimers) {
    vi.useFakeTimers()
    const user = await setupUserWithFakeTimers()
    return {
      user,
      cleanup: () => {
        cleanupFakeTimers()
        vi.clearAllMocks()
      }
    }
  }
  
  const user = await setupUser()
  return {
    user,
    cleanup: () => {
      vi.clearAllMocks()
    }
  }
}