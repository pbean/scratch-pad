import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useScratchPadStore } from '../store'
import type { Note, ApiError } from '../../types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Import the mocked invoke function
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
    // Reset store state before each test
    useScratchPadStore.setState({
      notes: [],
      activeNoteId: null,
      currentView: 'note',
      isCommandPaletteOpen: false,
      isLoading: false,
      error: null,
      expandedFolders: new Set(['recent', 'all-notes']),
      selectedSearchIndex: 0,
      searchQuery: ''
    })
    
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useScratchPadStore.getState()
      
      expect(state.notes).toEqual([])
      expect(state.activeNoteId).toBeNull()
      expect(state.currentView).toBe('note')
      expect(state.isCommandPaletteOpen).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.expandedFolders).toEqual(new Set(['recent', 'all-notes']))
      expect(state.selectedSearchIndex).toBe(0)
      expect(state.searchQuery).toBe('')
    })
  })

  describe('View Actions', () => {
    it('should set current view', () => {
      const { setCurrentView } = useScratchPadStore.getState()
      
      setCurrentView('search-history')
      
      expect(useScratchPadStore.getState().currentView).toBe('search-history')
    })

    it('should toggle command palette', () => {
      const { setCommandPaletteOpen } = useScratchPadStore.getState()
      
      setCommandPaletteOpen(true)
      expect(useScratchPadStore.getState().isCommandPaletteOpen).toBe(true)
      
      setCommandPaletteOpen(false)
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
      
      setError(null)
      expect(useScratchPadStore.getState().error).toBeNull()
    })
  })

  describe('Note Management', () => {
    it('should load notes successfully', async () => {
      const mockNotes = [mockNote]
      mockInvoke.mockResolvedValue(mockNotes)
      
      const { loadNotes } = useScratchPadStore.getState()
      
      await loadNotes()
      
      const state = useScratchPadStore.getState()
      expect(mockInvoke).toHaveBeenCalledWith('get_all_notes')
      expect(state.notes).toEqual(mockNotes)
      expect(state.activeNoteId).toBe(1)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle load notes error', async () => {
      mockInvoke.mockRejectedValue(mockApiError)
      
      const { loadNotes } = useScratchPadStore.getState()
      
      await loadNotes()
      
      const state = useScratchPadStore.getState()
      expect(state.error).toBe(mockApiError.message)
      expect(state.isLoading).toBe(false)
    })

    it('should save note successfully', async () => {
      const updatedNote = { ...mockNote, content: 'Updated content' }
      mockInvoke.mockResolvedValue(updatedNote)
      
      // Set up initial state
      useScratchPadStore.setState({
        notes: [mockNote],
        activeNoteId: 1
      })
      
      const { saveNote } = useScratchPadStore.getState()
      
      await saveNote('Updated content')
      
      expect(mockInvoke).toHaveBeenCalledWith('update_note', {
        note: { ...mockNote, content: 'Updated content' }
      })
      
      const state = useScratchPadStore.getState()
      expect(state.notes[0].content).toBe('Updated content')
    })

    it('should create note successfully', async () => {
      const newNote = { ...mockNote, id: 2, content: 'New note' }
      mockInvoke.mockResolvedValue(newNote)
      
      const { createNote } = useScratchPadStore.getState()
      
      await createNote('New note')
      
      expect(mockInvoke).toHaveBeenCalledWith('create_note', { content: 'New note' })
      
      const state = useScratchPadStore.getState()
      expect(state.notes).toContain(newNote)
      expect(state.activeNoteId).toBe(2)
      expect(state.currentView).toBe('note')
      expect(state.isLoading).toBe(false)
    })

    it('should delete note successfully', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      // Set up initial state with multiple notes
      const note2 = { ...mockNote, id: 2 }
      useScratchPadStore.setState({
        notes: [mockNote, note2],
        activeNoteId: 1
      })
      
      const { deleteNote } = useScratchPadStore.getState()
      
      await deleteNote(1)
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_note', { id: 1 })
      
      const state = useScratchPadStore.getState()
      expect(state.notes).toHaveLength(1)
      expect(state.notes[0].id).toBe(2)
      expect(state.activeNoteId).toBe(2) // Should switch to remaining note
    })

    it('should update note successfully', async () => {
      const updatedNote = { ...mockNote, content: 'Updated' }
      mockInvoke.mockResolvedValue(updatedNote)
      
      useScratchPadStore.setState({ notes: [mockNote] })
      
      const { updateNote } = useScratchPadStore.getState()
      
      await updateNote(updatedNote)
      
      expect(mockInvoke).toHaveBeenCalledWith('update_note', { note: updatedNote })
      
      const state = useScratchPadStore.getState()
      expect(state.notes[0]).toEqual(updatedNote)
    })
  })

  describe('Search Functionality', () => {
    it('should set search query', () => {
      const { setSearchQuery } = useScratchPadStore.getState()
      
      setSearchQuery('test query')
      
      const state = useScratchPadStore.getState()
      expect(state.searchQuery).toBe('test query')
      expect(state.selectedSearchIndex).toBe(0) // Should reset index
    })

    it('should search notes successfully', async () => {
      const searchResults = [mockNote]
      mockInvoke.mockResolvedValue(searchResults)
      
      const { searchNotes } = useScratchPadStore.getState()
      
      const results = await searchNotes('test')
      
      expect(mockInvoke).toHaveBeenCalledWith('search_notes', { query: 'test' })
      expect(results).toEqual(searchResults)
    })

    it('should handle search error', async () => {
      mockInvoke.mockRejectedValue(mockApiError)
      
      const { searchNotes } = useScratchPadStore.getState()
      
      const results = await searchNotes('test')
      
      expect(results).toEqual([])
      expect(useScratchPadStore.getState().error).toBe(mockApiError.message)
    })

    it('should set selected search index', () => {
      const { setSelectedSearchIndex } = useScratchPadStore.getState()
      
      setSelectedSearchIndex(5)
      
      expect(useScratchPadStore.getState().selectedSearchIndex).toBe(5)
    })
  })

  describe('UI Helpers', () => {
    it('should toggle folder expansion', () => {
      const { toggleFolder } = useScratchPadStore.getState()
      
      // Initially expanded
      expect(useScratchPadStore.getState().expandedFolders.has('recent')).toBe(true)
      
      toggleFolder('recent')
      expect(useScratchPadStore.getState().expandedFolders.has('recent')).toBe(false)
      
      toggleFolder('recent')
      expect(useScratchPadStore.getState().expandedFolders.has('recent')).toBe(true)
      
      // New folder
      toggleFolder('new-folder')
      expect(useScratchPadStore.getState().expandedFolders.has('new-folder')).toBe(true)
    })

    it('should get active note', () => {
      useScratchPadStore.setState({
        notes: [mockNote],
        activeNoteId: 1
      })
      
      const { getActiveNote } = useScratchPadStore.getState()
      
      expect(getActiveNote()).toEqual(mockNote)
    })

    it('should return undefined for non-existent active note', () => {
      useScratchPadStore.setState({
        notes: [mockNote],
        activeNoteId: 999
      })
      
      const { getActiveNote } = useScratchPadStore.getState()
      
      expect(getActiveNote()).toBeUndefined()
    })
  })

  describe('Settings Management', () => {
    it('should get all settings', async () => {
      const mockSettings = { setting1: 'value1', setting2: 'value2' }
      mockInvoke.mockResolvedValue(mockSettings)
      
      const { getAllSettings } = useScratchPadStore.getState()
      
      const result = await getAllSettings()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_all_settings')
      expect(result).toEqual(mockSettings)
    })

    it('should get single setting', async () => {
      mockInvoke.mockResolvedValue('test-value')
      
      const { getSetting } = useScratchPadStore.getState()
      
      const result = await getSetting('test-key')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'test-key' })
      expect(result).toBe('test-value')
    })

    it('should set setting', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      const { setSetting } = useScratchPadStore.getState()
      
      await setSetting('test-key', 'test-value')
      
      expect(mockInvoke).toHaveBeenCalledWith('set_setting', { 
        key: 'test-key', 
        value: 'test-value' 
      })
    })
  })

  describe('Global Shortcut Management', () => {
    it('should get current global shortcut', async () => {
      mockInvoke.mockResolvedValue('Ctrl+Shift+N')
      
      const { getCurrentGlobalShortcut } = useScratchPadStore.getState()
      
      const result = await getCurrentGlobalShortcut()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_current_global_shortcut')
      expect(result).toBe('Ctrl+Shift+N')
    })

    it('should register global shortcut', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      const { registerGlobalShortcut } = useScratchPadStore.getState()
      
      await registerGlobalShortcut('Ctrl+Alt+S')
      
      expect(mockInvoke).toHaveBeenCalledWith('register_global_shortcut', { 
        shortcut: 'Ctrl+Alt+S' 
      })
    })

    it('should test global shortcut', async () => {
      mockInvoke.mockResolvedValue(true)
      
      const { testGlobalShortcut } = useScratchPadStore.getState()
      
      const result = await testGlobalShortcut('Ctrl+Alt+T')
      
      expect(mockInvoke).toHaveBeenCalledWith('test_global_shortcut', { 
        shortcut: 'Ctrl+Alt+T' 
      })
      expect(result).toBe(true)
    })
  })

  describe('Window Management', () => {
    it('should show window', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      const { showWindow } = useScratchPadStore.getState()
      
      await showWindow()
      
      expect(mockInvoke).toHaveBeenCalledWith('show_window')
    })

    it('should hide window', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      const { hideWindow } = useScratchPadStore.getState()
      
      await hideWindow()
      
      expect(mockInvoke).toHaveBeenCalledWith('hide_window')
    })

    it('should set layout mode', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      const { setLayoutMode } = useScratchPadStore.getState()
      
      await setLayoutMode('half')
      
      expect(mockInvoke).toHaveBeenCalledWith('set_layout_mode', { mode: 'half' })
    })

    it('should get layout mode', async () => {
      mockInvoke.mockResolvedValue('full')
      
      const { getLayoutMode } = useScratchPadStore.getState()
      
      const result = await getLayoutMode()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_layout_mode')
      expect(result).toBe('full')
    })
  })

  describe('Plugin Management', () => {
    it('should get plugin info', async () => {
      const mockPluginInfo = [{ name: 'test-plugin', version: '1.0.0' }]
      mockInvoke.mockResolvedValue(mockPluginInfo)
      
      const { getPluginInfo } = useScratchPadStore.getState()
      
      const result = await getPluginInfo()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin_info')
      expect(result).toEqual(mockPluginInfo)
    })

    it('should get plugin count', async () => {
      mockInvoke.mockResolvedValue(3)
      
      const { getPluginCount } = useScratchPadStore.getState()
      
      const result = await getPluginCount()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin_count')
      expect(result).toBe(3)
    })

    it('should get available note formats', async () => {
      const mockFormats = ['plaintext', 'markdown', 'custom']
      mockInvoke.mockResolvedValue(mockFormats)
      
      const { getAvailableNoteFormats } = useScratchPadStore.getState()
      
      const result = await getAvailableNoteFormats()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_available_note_formats')
      expect(result).toEqual(mockFormats)
    })

    it('should handle plugin errors gracefully', async () => {
      mockInvoke.mockRejectedValue(mockApiError)
      
      const { getAvailableNoteFormats } = useScratchPadStore.getState()
      
      const result = await getAvailableNoteFormats()
      
      expect(result).toEqual(['plaintext', 'markdown']) // fallback
      expect(useScratchPadStore.getState().error).toBe(mockApiError.message)
    })
  })
})