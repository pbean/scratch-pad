import { vi } from 'vitest'

/**
 * Setup fake timers for testing
 */
export function setupFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
}

/**
 * Advance timers and flush promises
 */
export async function advanceAndFlush(ms: number) {
  vi.advanceTimersByTime(ms)
  // Flush microtasks and promises
  await Promise.resolve()
  await vi.runOnlyPendingTimersAsync()
}

/**
 * Run all timers and flush promises
 */
export async function runAllTimersAndFlush() {
  vi.runAllTimers()
  await Promise.resolve()
}

/**
 * Advance to next timer and flush
 */
export async function advanceToNextTimer() {
  vi.advanceTimersToNextTimer()
  await Promise.resolve()
}

/**
 * Clear all timers and reset to real timers
 */
export function resetTimers() {
  vi.clearAllTimers()
  vi.useRealTimers()
}