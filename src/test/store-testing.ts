import { vi } from 'vitest'
import { useScratchPadStore } from '../lib/store'
import { invoke } from '@tauri-apps/api/core'

// Get the mocked invoke function
// This will be the vi.fn() created in setup.ts
export const mockInvoke = invoke as any

// Map to track all store spies
const storeSpies = new Map<string, any>()

// Map to track original implementations
const originalMethods = new Map<string, any>()

/**
 * Spy on a store method while preserving its original functionality
 */
export function spyOnStore(methodName: string) {
  const store = useScratchPadStore.getState()
  const original = (store as any)[methodName]
  
  // Save original implementation if not already saved
  if (!originalMethods.has(methodName)) {
    originalMethods.set(methodName, original)
  }

  // Create spy that calls through to original
  const spy = vi.fn((...args: any[]) => {
    const originalMethod = originalMethods.get(methodName)
    if (typeof originalMethod === 'function') {
      return originalMethod.apply(store, args)
    }
    return originalMethod
  })

  // Update store with spy
  useScratchPadStore.setState({ [methodName]: spy })
  storeSpies.set(methodName, spy)

  return spy
}

/**
 * Mock a store method with a custom implementation
 */
export function mockStoreMethod(methodName: string, implementation: any) {
  const store = useScratchPadStore.getState()
  
  // Save original implementation if not already saved
  if (!originalMethods.has(methodName)) {
    originalMethods.set(methodName, (store as any)[methodName])
  }
  
  // If implementation is a function, track it as a spy
  if (typeof implementation === 'function' && implementation._isMockFunction) {
    storeSpies.set(methodName, implementation)
  }
  
  // Update store with new implementation
  useScratchPadStore.setState({ [methodName]: implementation })
  
  return implementation
}

/**
 * Set mock data in the store
 */
export function setMockStoreData(data: any) {
  useScratchPadStore.setState(data)
}

/**
 * Get a spy for a store method
 */
export function getStoreSpy(methodName: string) {
  return storeSpies.get(methodName)
}

/**
 * Reset all store spies and restore original implementations
 */
export function resetStoreSpies() {
  // Restore original methods
  const restoredMethods: any = {}
  for (const [methodName, original] of originalMethods.entries()) {
    restoredMethods[methodName] = original
  }
  
  if (Object.keys(restoredMethods).length > 0) {
    useScratchPadStore.setState(restoredMethods)
  }
  
  // Clear tracking maps
  storeSpies.clear()
  originalMethods.clear()
}

/**
 * Clear all store spy calls without resetting implementations
 */
export function clearStoreSpyCalls() {
  for (const spy of storeSpies.values()) {
    if (spy && spy.mockClear) {
      spy.mockClear()
    }
  }
}