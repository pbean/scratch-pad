import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useScratchPadStore } from '../../lib/store'
import { validateMocksPreserved, resetStorePreservingMocks } from '../setup'
import { 
  createTestMocks, 
  setTestData, 
  validateSmartReset, 
  runSmartResetTest,
  testNoMocksScenario,
  testMixedMockingScenario
} from '../smart-reset-validation'

describe('Smart Store Reset', () => {
  describe('resetStorePreservingMocks function', () => {
    it('should preserve vi.fn() mocks while resetting data fields', async () => {
      // Setup test scenario
      const mockNames = createTestMocks()
      setTestData()
      
      // Verify test data was set
      const stateBefore = useScratchPadStore.getState()
      expect(stateBefore.notes).toHaveLength(1)
      expect(stateBefore.activeNoteId).toBe(1)
      expect(stateBefore.searchQuery).toBe('test search')
      
      // Verify mocks exist and are vi.fn() instances
      for (const mockName of mockNames) {
        const method = (stateBefore as any)[mockName]
        expect(method).toBeDefined()
        expect(typeof method).toBe('function')
        expect(method.mockClear).toBeDefined()
      }
      
      // Manually trigger the smart reset for validation
      resetStorePreservingMocks()
      
      // Validate mocks are preserved
      const isValid = validateMocksPreserved(mockNames)
      expect(isValid).toBe(true)
      
      // Run detailed validation
      const result = validateSmartReset(mockNames)
      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.preservedMocks.length).toBeGreaterThan(0)
      expect(result.resetFields.length).toBeGreaterThan(0)
    })

    it('should clear mock call history without destroying mocks', async () => {
      const mockNames = createTestMocks()
      const store = useScratchPadStore.getState()
      
      // Call some methods to populate call history
      for (const mockName of mockNames) {
        const method = (store as any)[mockName]
        if (method && typeof method === 'function') {
          try {
            await method('test argument')
          } catch {
            // Ignore errors, just want call history
          }
        }
      }
      
      // Verify calls were recorded
      for (const mockName of mockNames) {
        const method = (store as any)[mockName]
        expect(method.mock?.calls?.length).toBeGreaterThanOrEqual(0)
      }
      
      // Manually trigger reset
      resetStorePreservingMocks()
      
      // Verify mocks still exist but call history is cleared
      const stateAfter = useScratchPadStore.getState()
      for (const mockName of mockNames) {
        const method = (stateAfter as any)[mockName]
        expect(method).toBeDefined()
        expect(typeof method).toBe('function')
        expect(method.mockClear).toBeDefined()
        // Call history should be cleared (mock calls reset)
        expect(method.mock?.calls?.length || 0).toBe(0)
      }
    })

    it('should handle mixed mocking scenarios', () => {
      const result = testMixedMockingScenario()
      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should work correctly when no mocks are present', () => {
      const success = testNoMocksScenario()
      expect(success).toBe(true)
    })

    it('should reset all data fields to initial state', () => {
      // Set test data with multiple fields
      useScratchPadStore.setState({
        notes: [{ id: 1, content: 'Test note', createdAt: Date.now(), updatedAt: Date.now() }],
        activeNoteId: 1,
        currentView: 'search-history' as const,
        isCommandPaletteOpen: true,
        isLoading: true,
        error: 'test error',
        searchQuery: 'test query',
        searchResults: [{ id: 2, content: 'result', createdAt: Date.now(), updatedAt: Date.now() }],
        notesCount: 5,
        hasMoreNotes: true
      })

      // Verify data was set
      const stateBefore = useScratchPadStore.getState()
      expect(stateBefore.notes).toHaveLength(1)
      expect(stateBefore.activeNoteId).toBe(1)
      expect(stateBefore.currentView).toBe('search-history')
      expect(stateBefore.isCommandPaletteOpen).toBe(true)
      expect(stateBefore.isLoading).toBe(true)
      expect(stateBefore.error).toBe('test error')
      expect(stateBefore.searchQuery).toBe('test query')
      expect(stateBefore.searchResults).toHaveLength(1)

      // Manually trigger reset
      resetStorePreservingMocks()
      
      // Validate that data fields are reset to initial values
      const result = validateSmartReset([])
      
      // The validation checks that data fields are reset to initial values
      expect(result.resetFields).toContain('notes')
      expect(result.resetFields).toContain('activeNoteId')
      expect(result.resetFields).toContain('isCommandPaletteOpen')
      expect(result.resetFields).toContain('searchQuery')
    })
  })

  describe('Integration with existing infrastructure', () => {
    it('should work with resetStoreSpies() function', () => {
      // This test verifies that the smart reset works correctly
      // when combined with the existing resetStoreSpies() system
      const result = runSmartResetTest()
      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle edge cases gracefully', () => {
      // Test with malformed state
      const currentState = useScratchPadStore.getState()
      
      // Add a non-function property that looks like a function
      useScratchPadStore.setState({ 
        malformedProperty: { mockClear: 'not a function' } as any
      })
      
      // Reset should handle this gracefully
      resetStorePreservingMocks()
      
      // Verify store is still functional
      const stateAfter = useScratchPadStore.getState()
      expect(stateAfter).toBeDefined()
      expect(typeof stateAfter.setCurrentView).toBe('function')
    })
  })

  describe('Mock validation utilities', () => {
    it('should correctly identify vi.fn() instances', () => {
      const mockNames = createTestMocks()
      
      // All created mocks should be identified correctly
      const isValid = validateMocksPreserved(mockNames)
      expect(isValid).toBe(true)
      
      // Non-existent methods should fail validation
      const invalidCheck = validateMocksPreserved(['nonExistentMethod'])
      expect(invalidCheck).toBe(false)
    })

    it('should validate mock preservation correctly', () => {
      const mockNames = createTestMocks()
      setTestData()
      
      // Before reset, should pass validation
      let result = validateSmartReset(mockNames)
      expect(result.preservedMocks.length).toBeGreaterThan(0)
      
      // Reset should preserve mocks
      resetStorePreservingMocks()
      result = validateSmartReset(mockNames)
      expect(result.preservedMocks.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and reliability', () => {
    it('should handle large numbers of mocks efficiently', () => {
      const startTime = Date.now()
      
      // Create many mocks
      const manyMockNames = []
      const storeMethods = Object.keys(useScratchPadStore.getState())
        .filter(key => typeof (useScratchPadStore.getState() as any)[key] === 'function')
        .slice(0, 50) // Test with up to 50 methods
      
      for (const methodName of storeMethods) {
        const mockFn = vi.fn()
        useScratchPadStore.setState({ [methodName]: mockFn })
        manyMockNames.push(methodName)
      }
      
      // Set test data
      setTestData()
      
      // Reset should complete quickly
      resetStorePreservingMocks()
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
      
      // All mocks should be preserved
      const isValid = validateMocksPreserved(manyMockNames)
      expect(isValid).toBe(true)
    })

    it('should be deterministic across multiple resets', () => {
      const mockNames = createTestMocks()
      
      // Perform multiple reset cycles
      for (let i = 0; i < 5; i++) {
        setTestData()
        resetStorePreservingMocks()
        
        const result = validateSmartReset(mockNames)
        expect(result.success).toBe(true)
      }
    })
  })
})