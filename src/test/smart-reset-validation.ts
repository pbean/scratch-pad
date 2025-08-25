import { vi } from 'vitest'
import { useScratchPadStore } from '../lib/store'
import { validateMocksPreserved, getInitialStoreState, resetStorePreservingMocks } from './setup'

/**
 * Test utility to validate smart store reset functionality
 * This helps ensure the resetStorePreservingMocks() function works correctly
 */

export interface MockValidationResult {
  success: boolean
  preservedMocks: string[]
  resetFields: string[]
  errors: string[]
}

/**
 * Create test mocks in the store for validation
 */
export function createTestMocks(): string[] {
  const store = useScratchPadStore.getState()
  const mockNames: string[] = []
  
  // Mock some store methods that tests commonly use
  const mocksToCreate = [
    'createNote',
    'updateNote', 
    'deleteNote',
    'searchNotes',
    'setCurrentView',
    'setCommandPaletteOpen'
  ]
  
  mocksToCreate.forEach(methodName => {
    const currentMethod = (store as any)[methodName]
    if (typeof currentMethod === 'function') {
      // Create a vi.fn() mock that preserves original behavior
      const mockFn = vi.fn((...args: any[]) => {
        // Call original if it exists and is a function
        if (typeof currentMethod === 'function') {
          return currentMethod.apply(store, args)
        }
        return Promise.resolve()
      })
      
      // Set the mock in the store
      useScratchPadStore.setState({ [methodName]: mockFn })
      mockNames.push(methodName)
    }
  })
  
  return mockNames
}

/**
 * Set test data that should be reset
 */
export function setTestData() {
  useScratchPadStore.setState({
    notes: [{ id: 1, content: 'Test note', createdAt: Date.now(), updatedAt: Date.now() }],
    activeNoteId: 1,
    isCommandPaletteOpen: true,
    searchQuery: 'test search',
    error: 'test error',
    isLoading: true
  })
}

/**
 * Validate that the smart reset worked correctly
 */
export function validateSmartReset(expectedMocks: string[]): MockValidationResult {
  const result: MockValidationResult = {
    success: true,
    preservedMocks: [],
    resetFields: [],
    errors: []
  }
  
  const currentState = useScratchPadStore.getState()
  const initialState = getInitialStoreState()
  
  // Check that mocks are preserved
  for (const mockName of expectedMocks) {
    const method = (currentState as any)[mockName]
    if (method && typeof method === 'function' && 
        (method._isMockFunction || typeof method.mockClear === 'function')) {
      result.preservedMocks.push(mockName)
    } else {
      result.errors.push(`Mock ${mockName} was not preserved`)
      result.success = false
    }
  }
  
  // Check that data fields are reset
  const dataFields = [
    'notes', 'activeNoteId', 'isCommandPaletteOpen', 
    'searchQuery', 'error', 'isLoading'
  ]
  
  for (const field of dataFields) {
    const currentValue = (currentState as any)[field]
    const initialValue = (initialState as any)[field]
    
    // For arrays and objects, do deep comparison
    if (Array.isArray(initialValue)) {
      if (Array.isArray(currentValue) && currentValue.length === initialValue.length) {
        result.resetFields.push(field)
      } else {
        result.errors.push(`Field ${field} was not reset to initial array state`)
        result.success = false
      }
    } else if (initialValue instanceof Set) {
      // Handle Set comparison
      if (currentValue instanceof Set && currentValue.size === initialValue.size) {
        let setsEqual = true
        for (const item of initialValue) {
          if (!currentValue.has(item)) {
            setsEqual = false
            break
          }
        }
        if (setsEqual) {
          result.resetFields.push(field)
        } else {
          result.errors.push(`Field ${field} was not reset to initial Set state`)
          result.success = false
        }
      } else {
        result.errors.push(`Field ${field} was not reset to initial Set state`)
        result.success = false
      }
    } else if (currentValue === initialValue) {
      result.resetFields.push(field)
    } else {
      result.errors.push(`Field ${field} was not reset (expected: ${initialValue}, got: ${currentValue})`)
      result.success = false
    }
  }
  
  return result
}

/**
 * Run a complete validation test
 */
export function runSmartResetTest(): MockValidationResult {
  // Step 1: Create mocks
  const mockNames = createTestMocks()
  
  // Step 2: Set test data that should be reset
  setTestData()
  
  // Step 3: Manually call the smart reset function
  resetStorePreservingMocks()
  
  // Step 4: Verify mocks are preserved and data is reset
  const isValid = validateMocksPreserved(mockNames)
  const detailedResult = validateSmartReset(mockNames)
  
  if (!isValid) {
    detailedResult.success = false
    detailedResult.errors.unshift('validateMocksPreserved() returned false')
  }
  
  return detailedResult
}

/**
 * Test edge case: no mocks present
 */
export function testNoMocksScenario(): boolean {
  // Set some test data
  setTestData()
  
  // Manually call the smart reset function
  resetStorePreservingMocks()
  
  // The smart reset should work even when no mocks are present
  // Just validate that data gets reset
  const result = validateSmartReset([])
  return result.success
}

/**
 * Test edge case: mixed vi.spyOn() and direct assignment
 */
export function testMixedMockingScenario(): MockValidationResult {
  const store = useScratchPadStore.getState()
  
  // Create one direct vi.fn() mock
  const directMock = vi.fn()
  useScratchPadStore.setState({ createNote: directMock })
  
  // Create one vi.spyOn() mock (this creates a different type of mock)
  const spyMock = vi.spyOn(store, 'updateNote' as any)
  
  const mockNames = ['createNote', 'updateNote']
  
  // Set test data
  setTestData()
  
  // Manually call the smart reset function
  resetStorePreservingMocks()
  
  // Validate both types of mocks are preserved
  return validateSmartReset(mockNames)
}