import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScratchPadStore } from '../../lib/store'
import { mockStoreMethod, setMockStoreData, spyOnStore } from '../store-test-utils'

describe('store-test-utils', () => {
  beforeEach(() => {
    // Reset store is handled by setup.ts
  })

  it('should mock store methods correctly', async () => {
    // Mock a method
    const searchSpy = mockStoreMethod('searchNotes', vi.fn().mockResolvedValue(['test result']))
    
    // Call the method
    const result = await useScratchPadStore.getState().searchNotes('test')
    
    // Verify it was called and returned the mock value
    expect(searchSpy).toHaveBeenCalledWith('test')
    expect(result).toEqual(['test result'])
  })

  it('should spy on store methods without replacing implementation', () => {
    // Spy on a method
    const setViewSpy = spyOnStore('setCurrentView')
    
    // Call the method
    useScratchPadStore.getState().setCurrentView('settings')
    
    // Verify it was called
    expect(setViewSpy).toHaveBeenCalledWith('settings')
    
    // Verify the state was actually updated
    expect(useScratchPadStore.getState().currentView).toBe('settings')
  })

  it('should set mock data without affecting functions', () => {
    // Get original function reference
    const originalCreateNote = useScratchPadStore.getState().createNote
    
    // Set mock data
    setMockStoreData({
      notes: [{ id: 1, content: 'test' } as any],
      activeNoteId: 1
    })
    
    // Verify data was set
    expect(useScratchPadStore.getState().notes).toHaveLength(1)
    expect(useScratchPadStore.getState().activeNoteId).toBe(1)
    
    // Verify function wasn't replaced
    expect(useScratchPadStore.getState().createNote).toBe(originalCreateNote)
  })

  it('should preserve mocked functions after data reset', () => {
    // Mock a function
    const mockFn = vi.fn().mockResolvedValue('mocked')
    mockStoreMethod('loadNotes', mockFn)
    
    // Set some data
    setMockStoreData({ notes: [{ id: 1 } as any] })
    
    // Verify the mock is still there
    expect(useScratchPadStore.getState().loadNotes).toBe(mockFn)
  })
})