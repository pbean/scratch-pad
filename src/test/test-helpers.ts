import { userEvent } from '@testing-library/user-event'
import { vi } from 'vitest'

/**
 * Creates a fresh userEvent instance for each test to prevent conflicts
 * between tests when running in parallel or sequence.
 */
export function createUser() {
  return userEvent.setup({ 
    delay: null,
    advanceTimers: vi.advanceTimersByTime
  })
}