import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '../../../test/test-utils'
// import userEvent from '@testing-library/user-event'
import { NoteView } from '../NoteView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Import the mocked invoke function
import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

// Mock useSmartAutoSave hook
vi.mock('../../../hooks/useSmartAutoSave', () => ({
  useSmartAutoSave: vi.fn(() => ({
    saveContent: vi.fn(),
    forceSave: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
    lastSaved: null,
    isIdle: false
  }))
}))

// Mock child components
vi.mock('../TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar">Tab Bar</div>
}))

vi.mock('../StatusBar', () => ({
  StatusBar: ({ noteTitle, wordCount, charCount, lineCount, isAutoSaving, lastSaved }: any) => (
    <div data-testid="status-bar">
      <span data-testid="note-title">{noteTitle}</span>
      <span data-testid="word-count">{wordCount}</span>
      <span data-testid="char-count">{charCount}</span>
      <span data-testid="line-count">{lineCount}</span>
      <span data-testid="is-auto-saving">{isAutoSaving.toString()}</span>
      <span data-testid="last-saved">{lastSaved?.toISOString() || 'null'}</span>
    </div>
  )
}))

const mockNote: Note = {
  id: 1,
  content: 'Test note content\nSecond line',
  format: 'plaintext',
  nickname: 'Test Note',
  path: '/test/path',
  is_favorite: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  search_content: 'Test note content Second line',
  word_count: 5,
  language: 'en'
}

describe('NoteView', () => {
  // const _user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
    
    // Reset store state
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote],
        activeNoteId: 1,
        getActiveNote: () => mockNote,
        saveNote: vi.fn(),
        setActiveNote: vi.fn(),
        setCommandPaletteOpen: vi.fn(),
        createNote: vi.fn(),
        deleteNote: vi.fn(),
        setCurrentView: vi.fn()
      })
    })
    
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should render textarea with note content', async () => {
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('Test note content\nSecond line')
  })

  it('should render tab bar when multiple notes exist', async () => {
    const note2 = { ...mockNote, id: 2, content: 'Second note' }
    
    act(() => {
      useScratchPadStore.setState({ notes: [mockNote, note2] })
    })
    
    render(<NoteView />)
    
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
  })

  it('should not render tab bar when only one note exists', async () => {
    act(() => {
      useScratchPadStore.setState({ notes: [mockNote] })
    })
    
    render(<NoteView />)
    
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument()
  })

  it('should render status bar with correct props', async () => {
    render(<NoteView />)
    
    expect(screen.getByTestId('status-bar')).toBeInTheDocument()
    expect(screen.getByTestId('note-title')).toHaveTextContent('Test Note')
    expect(screen.getByTestId('word-count')).toHaveTextContent('5') // "Test note content\nSecond line"
    expect(screen.getByTestId('char-count')).toHaveTextContent('29') // Length of content
    expect(screen.getByTestId('line-count')).toHaveTextContent('2') // Two lines
  })

  it('should auto-focus textarea on mount', async () => {
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    expect(textarea).toHaveFocus()
  })

  it('should update content when typing', async () => {
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    // Use fireEvent for more reliable testing
    act(() => {
      fireEvent.change(textarea, { target: { value: 'New content' } })
    })
    
    expect(textarea).toHaveValue('New content')
  })

  it('should auto-save after 2 seconds of inactivity', async () => {
    const mockSaveNote = vi.fn().mockResolvedValue(undefined)
    
    act(() => {
      useScratchPadStore.setState({ saveNote: mockSaveNote })
    })
    
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    // Change content
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Modified content' } })
    })
    
    // Fast-forward time by 2 seconds to trigger auto-save
    await act(async () => {
      vi.advanceTimersByTime(2000)
      // Allow any pending promises to resolve
      await Promise.resolve()
    })
    
    expect(mockSaveNote).toHaveBeenCalledWith('Modified content')
  })

  it('should not auto-save if content unchanged', async () => {
    const mockSaveNote = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({ saveNote: mockSaveNote })
    })
    
    render(<NoteView />)
    
    // Don't change content, just wait
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(mockSaveNote).not.toHaveBeenCalled()
  })

  it('should handle Ctrl+P to open command palette', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({ setCommandPaletteOpen: mockSetCommandPaletteOpen })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'p', ctrlKey: true })
    })
    
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(true)
  })

  it('should handle Ctrl+Shift+F to open search view', async () => {
    const mockSetCurrentView = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'F', ctrlKey: true, shiftKey: true })
    })
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('search-history')
  })

  it('should handle Ctrl+N to create new note', async () => {
    const mockCreateNote = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({ createNote: mockCreateNote })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
    })
    
    expect(mockCreateNote).toHaveBeenCalled()
  })

  it('should handle Ctrl+S to manually save', async () => {
    const mockSaveNote = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({ saveNote: mockSaveNote })
    })
    
    const { container: _container } = render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Content to save' } })
      // Allow any async state updates to complete
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    act(() => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    })
    
    expect(mockSaveNote).toHaveBeenCalledWith('Content to save')
  })

  it('should handle Ctrl+W to close tab when multiple notes exist', async () => {
    const mockDeleteNote = vi.fn()
    const note2 = { ...mockNote, id: 2 }
    
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote, note2],
        activeNoteId: 1,
        deleteNote: mockDeleteNote
      })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'w', ctrlKey: true })
    })
    
    expect(mockDeleteNote).toHaveBeenCalledWith(1)
  })

  it('should not close tab with Ctrl+W when only one note exists', async () => {
    const mockDeleteNote = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote],
        deleteNote: mockDeleteNote
      })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'w', ctrlKey: true })
    })
    
    expect(mockDeleteNote).not.toHaveBeenCalled()
  })

  it('should handle tab navigation with Ctrl+Tab', async () => {
    const mockSetActiveNote = vi.fn()
    const note2 = { ...mockNote, id: 2 }
    const note3 = { ...mockNote, id: 3 }
    
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote, note2, note3],
        activeNoteId: 1,
        setActiveNote: mockSetActiveNote
      })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true })
    })
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(2) // Next tab
  })

  it('should handle reverse tab navigation with Ctrl+Shift+Tab', async () => {
    const mockSetActiveNote = vi.fn()
    const note2 = { ...mockNote, id: 2 }
    const note3 = { ...mockNote, id: 3 }
    
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote, note2, note3],
        activeNoteId: 2, // Start from middle
        setActiveNote: mockSetActiveNote
      })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true, shiftKey: true })
    })
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(1) // Previous tab
  })

  it('should handle number shortcuts to switch tabs', async () => {
    const mockSetActiveNote = vi.fn()
    const note2 = { ...mockNote, id: 2 }
    const note3 = { ...mockNote, id: 3 }
    
    act(() => {
      useScratchPadStore.setState({
        notes: [mockNote, note2, note3],
        setActiveNote: mockSetActiveNote
      })
    })
    
    render(<NoteView />)
    
    act(() => {
      fireEvent.keyDown(document, { key: '2', ctrlKey: true })
    })
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(2) // Second tab (index 1)
  })

  it('should handle layout mode shortcuts', async () => {
    mockInvoke.mockResolvedValue(undefined)
    
    render(<NoteView />)
    
    // Clear call count from beforeEach
    mockInvoke.mockClear()
    
    // Test Ctrl+Alt+1 for default layout
    await act(async () => {
      fireEvent.keyDown(document, { key: '1', ctrlKey: true, altKey: true })
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'set_layout_mode', { mode: 'default' })
    
    // Test Ctrl+Alt+2 for half layout
    await act(async () => {
      fireEvent.keyDown(document, { key: '2', ctrlKey: true, altKey: true })
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'set_layout_mode', { mode: 'half' })
    
    // Test Ctrl+Alt+3 for full layout
    await act(async () => {
      fireEvent.keyDown(document, { key: '3', ctrlKey: true, altKey: true })
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'set_layout_mode', { mode: 'full' })
  })

  it('should display placeholder when no note is selected', async () => {
    act(() => {
      useScratchPadStore.setState({
        notes: [],
        activeNoteId: null,
        getActiveNote: () => undefined
      })
    })
    
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    expect(textarea).toHaveAttribute('placeholder', 'No note selected')
  })

  it('should update content when active note changes', async () => {
    const note2 = { ...mockNote, id: 2, content: 'Different content' }
    
    const { rerender } = render(<NoteView />)
    
    // Change active note
    act(() => {
      useScratchPadStore.setState({
        activeNoteId: 2,
        getActiveNote: () => note2
      })
    })
    
    rerender(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    expect(textarea).toHaveValue('Different content')
  })

  it('should show auto-saving status', async () => {
    // Mock the useSmartAutoSave hook to return isSaving: true
    const { useSmartAutoSave } = await import('../../../hooks/useSmartAutoSave')
    vi.mocked(useSmartAutoSave).mockReturnValue({
      saveContent: vi.fn(),
      forceSave: vi.fn(),
      isSaving: true,
      lastSaved: null,
      isIdle: false
    })

    render(<NoteView />)
    
    // Should show auto-saving status
    expect(screen.getByTestId('is-auto-saving')).toHaveTextContent('true')
  })

  it('should handle save errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockSaveNote = vi.fn().mockRejectedValue(new Error('Save failed'))
    
    act(() => {
      useScratchPadStore.setState({ saveNote: mockSaveNote })
    })
    
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    // Change content
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Content that will fail to save' } })
    })
    
    // Trigger auto-save
    await act(async () => {
      vi.advanceTimersByTime(2000)
      // Allow the promise rejection to be handled
      await Promise.resolve()
    })
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to save note:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })

  it('should calculate word count correctly', async () => {
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'One two three four five' } })
    })
    
    expect(screen.getByTestId('word-count')).toHaveTextContent('5')
  })

  it('should handle empty content word count', async () => {
    render(<NoteView />)
    
    const textarea = screen.getByTestId('note-textarea')
    
    act(() => {
      fireEvent.change(textarea, { target: { value: '' } })
    })
    
    expect(screen.getByTestId('word-count')).toHaveTextContent('0')
  })

  it('should use nickname as title when available', async () => {
    render(<NoteView />)
    
    expect(screen.getByTestId('note-title')).toHaveTextContent('Test Note')
  })

  it('should use first line as title when no nickname', async () => {
    const noteWithoutNickname = { ...mockNote, nickname: undefined }
    
    act(() => {
      useScratchPadStore.setState({
        getActiveNote: () => noteWithoutNickname
      })
    })
    
    render(<NoteView />)
    
    expect(screen.getByTestId('note-title')).toHaveTextContent('Test note content')
  })

  it('should show "Untitled" when no content and no nickname', async () => {
    const emptyNote = { ...mockNote, content: '', nickname: undefined }
    
    act(() => {
      useScratchPadStore.setState({
        getActiveNote: () => emptyNote
      })
    })
    
    render(<NoteView />)
    
    expect(screen.getByTestId('note-title')).toHaveTextContent('Untitled')
  })
})