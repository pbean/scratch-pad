import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useScratchPadStore } from '../store'
import type { Note, ApiError } from '../../types'

// REMOVE duplicate mock - use global mock from setup
// Import the mocked invoke function from global mock
import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

// Mock data
const mockNote: Note = {
  id: 1,
  content: 'Test note content',
  search_content: 'Test note content',
  word_count: 3,
  format: 'plaintext',
  language: null,
  nickname: 'Test Note',
  path: '/test/path',
  is_favorite: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

const mockApiError: ApiError = {
  code: 'TEST_ERROR',
  message: 'Test error message'
}

describe('ScratchPadStore', () => {
  beforeEach(() => {
    // The global setup already resets store state
    // Just clear and setup the mock for this test
    mockInvoke.mockClear()
  })
  
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useScratchPadStore.getState()
      
      expect(state.notes).toEqual([])
      expect(state.activeNoteId).toBe(null)
      expect(state.currentView).toBe('note')
      expect(state.isCommandPaletteOpen).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.expandedFolders).toEqual(new Set(['recent', 'all-notes']))
      expect(state.selectedSearchIndex).toBe(0)
      expect(state.searchQuery).toBe('')
    })
  })

  describe('View Actions', () => {
    it('should set current view', () => {
      const { setCurrentView } = useScratchPadStore.getState()
      
      setCurrentView('search')
      
      expect(useScratchPadStore.getState().currentView).toBe('search')
    })

    it('should toggle command palette', () => {
      const { setCommandPaletteOpen } = useScratchPadStore.getState()
      const { isCommandPaletteOpen } = useScratchPadStore.getState()
      
      // Toggle on
      setCommandPaletteOpen(!isCommandPaletteOpen)
      expect(useScratchPadStore.getState().isCommandPaletteOpen).toBe(true)
      
      // Toggle off
      setCommandPaletteOpen(!useScratchPadStore.getState().isCommandPaletteOpen)
      expect(useScratchPadStore.getState().isCommandPaletteOpen).toBe(false)
    })

    it('should set active note', () => {
      const { setActiveNote } = useScratchPadStore.getState()
      
      setActiveNote(123)
      
      expect(useScratchPadStore.getState().activeNoteId).toBe(123)
    })

    it('should set error', () => {
      const { setError } = useScratchPadStore.getState()
      
      setError('Test error')
      
      expect(useScratchPadStore.getState().error).toBe('Test error')
    })
  })

  describe('Note Management', () => {
    it('should load notes successfully', async () => {
      const { loadNotes } = useScratchPadStore.getState()
      
      mockInvoke.mockResolvedValueOnce([mockNote])
      
      await loadNotes()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_all_notes')
      expect(useScratchPadStore.getState().notes).toEqual([mockNote])
    })

    it('should handle load notes error', async () => {
      const { loadNotes } = useScratchPadStore.getState()
      
      mockInvoke.mockRejectedValueOnce(mockApiError)
      
      await loadNotes()
      
      expect(useScratchPadStore.getState().error).toBe(mockApiError.message)
    })
  })
})