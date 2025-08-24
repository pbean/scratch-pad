import { vi } from 'vitest'
import { useScratchPadStore } from '../lib/store'

/**
 * Spy on a store method without replacing it
 * This allows tests to verify calls while keeping the original implementation
 */
export function spyOnStore(methodName: keyof ReturnType<typeof useScratchPadStore.getState>) {
  const store = useScratchPadStore.getState()
  const original = store[methodName]
  
  if (typeof original !== 'function') {
    throw new Error(`${String(methodName)} is not a function`)
  }
  
  // Create a spy on the store method
  const spy = vi.fn(original as any)
  // Replace the method in the store with the spy
  useScratchPadStore.setState({ [methodName]: spy } as any)
  return spy
}

/**
 * Mock a store method with a custom implementation
 * Useful when you need to control what the method returns
 */
export function mockStoreMethod(
  methodName: keyof ReturnType<typeof useScratchPadStore.getState>,
  implementation?: (...args: any[]) => any
) {
  const store = useScratchPadStore.getState()
  const original = store[methodName]
  
  if (typeof original !== 'function') {
    throw new Error(`${String(methodName)} is not a function`)
  }
  
  // Create a mock with the provided implementation or default
  const mock = implementation ? vi.fn(implementation) : vi.fn()
  // Replace the method in the store with the mock
  useScratchPadStore.setState({ [methodName]: mock } as any)
  return mock
}

/**
 * Set mock data in the store without affecting functions
 * This only updates data properties, preserving all function references
 */
export function setMockStoreData(data: Partial<ReturnType<typeof useScratchPadStore.getState>>) {
  const currentState = useScratchPadStore.getState()
  const newState: any = {}
  
  // Only set non-function properties
  Object.keys(data).forEach(key => {
    const value = data[key as keyof typeof data]
    if (typeof value !== 'function') {
      newState[key] = value
    }
  })
  
  useScratchPadStore.setState(newState)
}

/**
 * Reset all store mocks while preserving the functions
 * Useful in afterEach to clear mock history but keep spies active
 */
export function resetStoreMocks() {
  const state = useScratchPadStore.getState()
  Object.keys(state).forEach(key => {
    const value = state[key as keyof typeof state]
    if (typeof value === 'function' && 'mockClear' in value) {
      (value as any).mockClear()
    }
  })
}

/**
 * Helper to set up common mock scenarios
 */
export function setupMockStore(options: {
  notes?: any[]
  activeNoteId?: number | null
  isCommandPaletteOpen?: boolean
  searchResults?: any[]
  currentView?: string
} = {}) {
  setMockStoreData({
    notes: options.notes || [],
    activeNoteId: options.activeNoteId || null,
    isCommandPaletteOpen: options.isCommandPaletteOpen || false,
    searchResults: options.searchResults || [],
    currentView: (options.currentView || 'note') as any,
  })
}