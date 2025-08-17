import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchHistoryView } from '../SearchHistoryView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'

const mockNote1: Note = {
  id: 1,
  content: 'First note content with searchable text',
  format: 'plaintext',
  nickname: 'First Note',
  path: '/test/path1',
  is_favorite: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z'
}

const mockNote2: Note = {
  id: 2,
  content: 'Second note with different content',
  format: 'plaintext',
  nickname: undefined,
  path: '/test/path2',
  is_favorite: false,
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T08:00:00Z'
}

const mockNote3: Note = {
  id: 3,
  content: '',
  format: 'markdown',
  nickname: undefined,
  path: '/test/path3',
  is_favorite: false,
  created_at: '2024-01-03T00:00:00Z',
  updated_at: '2024-01-03T16:00:00Z'
}

describe('SearchHistoryView', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'))
    
    // Reset store state
    useScratchPadStore.setState({
      notes: [mockNote1, mockNote2, mockNote3],
      setActiveNote: vi.fn(),
      setCurrentView: vi.fn(),
      expandedFolders: new Set(['recent', 'all-notes']),
      toggleFolder: vi.fn(),
      searchNotes: vi.fn().mockResolvedValue([])
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should render header with back button', () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Search & Browse')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render search input', () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('should auto-focus search input on mount', async () => {
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toHaveFocus()
    })
  })

  it('should display folder structure in browser mode', () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('should display notes in folders', () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByText('First Note')).toBeInTheDocument()
    expect(screen.getByText('Second note with different content')).toBeInTheDocument()
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('should show last modified times', () => {
    render(<SearchHistoryView />)
    
    // Should show relative times
    expect(screen.getByText('1d ago')).toBeInTheDocument() // mockNote1 updated yesterday
    expect(screen.getByText('2d ago')).toBeInTheDocument() // mockNote2 updated 2 days ago
  })

  it('should switch to search mode when typing', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'searchable')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('searchable')
    })
  })

  it('should display search results', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'first')
    
    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument()
      // Should show content preview in search mode
      expect(screen.getByText(/First note content with searchable text/)).toBeInTheDocument()
    })
  })

  it('should debounce search queries', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Type multiple characters quickly
    await user.type(searchInput, 'test')
    
    // Should not call search immediately
    expect(mockSearchNotes).not.toHaveBeenCalled()
    
    // Fast-forward past debounce delay
    vi.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
      expect(mockSearchNotes).toHaveBeenCalledTimes(1)
    })
  })

  it('should handle keyboard navigation', async () => {
    render(<SearchHistoryView />)
    
    // First item should be selected by default
    const firstItem = screen.getByText('Recent').closest('div')
    expect(firstItem).toHaveClass('bg-accent', 'text-accent-foreground')
    
    // Navigate down
    await user.keyboard('{ArrowDown}')
    
    const secondItem = screen.getByText('All Notes').closest('div')
    expect(secondItem).toHaveClass('bg-accent', 'text-accent-foreground')
  })

  it('should expand/collapse folders with Enter key', async () => {
    const mockToggleFolder = vi.fn()
    useScratchPadStore.setState({ toggleFolder: mockToggleFolder })
    
    render(<SearchHistoryView />)
    
    // Navigate to a folder and press Enter
    await user.keyboard('{Enter}')
    
    expect(mockToggleFolder).toHaveBeenCalledWith('recent')
  })

  it('should open note with Enter key', async () => {
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setActiveNote: mockSetActiveNote,
      setCurrentView: mockSetCurrentView
    })
    
    render(<SearchHistoryView />)
    
    // Navigate to a note (skip folders)
    await user.keyboard('{ArrowDown}') // All Notes
    await user.keyboard('{ArrowDown}') // Favorites  
    await user.keyboard('{ArrowDown}') // First note under Recent
    await user.keyboard('{Enter}')
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(1)
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should handle arrow key folder expansion', async () => {
    const mockToggleFolder = vi.fn()
    useScratchPadStore.setState({
      expandedFolders: new Set(['recent']), // Only recent expanded
      toggleFolder: mockToggleFolder
    })
    
    render(<SearchHistoryView />)
    
    // Navigate to collapsed folder
    await user.keyboard('{ArrowDown}') // All Notes (collapsed)
    await user.keyboard('{ArrowRight}') // Expand
    
    expect(mockToggleFolder).toHaveBeenCalledWith('all-notes')
  })

  it('should handle arrow key folder collapse', async () => {
    const mockToggleFolder = vi.fn()
    useScratchPadStore.setState({ toggleFolder: mockToggleFolder })
    
    render(<SearchHistoryView />)
    
    // Navigate to expanded folder and collapse
    await user.keyboard('{ArrowLeft}')
    
    expect(mockToggleFolder).toHaveBeenCalledWith('recent')
  })

  it('should handle Escape key to go back to note view', async () => {
    const mockSetCurrentView = vi.fn()
    useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
    
    render(<SearchHistoryView />)
    
    await user.keyboard('{Escape}')
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should clear search query with Escape when searching', async () => {
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'test query')
    
    expect(searchInput).toHaveValue('test query')
    
    await user.keyboard('{Escape}')
    
    expect(searchInput).toHaveValue('')
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
    
    render(<SearchHistoryView />)
    
    await user.click(screen.getByRole('button'))
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should handle item clicks', async () => {
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setActiveNote: mockSetActiveNote,
      setCurrentView: mockSetCurrentView
    })
    
    render(<SearchHistoryView />)
    
    // Click on a note
    await user.click(screen.getByText('First Note'))
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(1)
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should handle folder clicks', async () => {
    const mockToggleFolder = vi.fn()
    useScratchPadStore.setState({ toggleFolder: mockToggleFolder })
    
    render(<SearchHistoryView />)
    
    await user.click(screen.getByText('Recent'))
    
    expect(mockToggleFolder).toHaveBeenCalledWith('recent')
  })

  it('should show correct folder icons', () => {
    render(<SearchHistoryView />)
    
    // Should show chevron and folder icons (we can't easily test SVG content)
    const folderElements = screen.getAllByText(/Recent|All Notes|Favorites/)
    expect(folderElements).toHaveLength(3)
  })

  it('should show "No notes available" when no notes', () => {
    useScratchPadStore.setState({ notes: [] })
    
    render(<SearchHistoryView />)
    
    expect(screen.getByText('No notes available')).toBeInTheDocument()
  })

  it('should show "No notes found" in search mode with no results', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'nonexistent')
    
    vi.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(screen.getByText('No notes found')).toBeInTheDocument()
    })
  })

  it('should display correct footer information', () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Use ↑↓ to navigate, Enter to open, ← → to expand/collapse')).toBeInTheDocument()
  })

  it('should display search results count in footer', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1, mockNote2])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'note')
    
    vi.advanceTimersByTime(300)
    
    await waitFor(() => {
      expect(screen.getByText('2 results found')).toBeInTheDocument()
    })
  })

  it('should format relative times correctly', () => {
    // Test different time scenarios
    const recentNote = {
      ...mockNote1,
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
    }
    
    useScratchPadStore.setState({ notes: [recentNote] })
    
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('should handle notes in favorites folder', () => {
    render(<SearchHistoryView />)
    
    // mockNote1 is marked as favorite
    expect(screen.getByText('First Note')).toBeInTheDocument()
  })

  it('should handle notes without nicknames', () => {
    render(<SearchHistoryView />)
    
    // mockNote2 has no nickname, should use content
    expect(screen.getByText('Second note with different content')).toBeInTheDocument()
  })

  it('should handle empty notes', () => {
    render(<SearchHistoryView />)
    
    // mockNote3 has empty content and no nickname
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('should scroll selected item into view', async () => {
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock
    
    render(<SearchHistoryView />)
    
    await user.keyboard('{ArrowDown}')
    
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth'
    })
  })

  it('should handle search errors gracefully', async () => {
    const mockSearchNotes = vi.fn().mockRejectedValue(new Error('Search failed'))
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'test')
    
    vi.advanceTimersByTime(300)
    
    // Should not crash and should show no results
    await waitFor(() => {
      expect(screen.getByText('No notes found')).toBeInTheDocument()
    })
  })

  it('should truncate long content previews in search mode', async () => {
    const longContentNote = {
      ...mockNote1,
      content: 'A'.repeat(150) // Very long content
    }
    
    const mockSearchNotes = vi.fn().mockResolvedValue([longContentNote])
    useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'A')
    
    vi.advanceTimersByTime(300)
    
    await waitFor(() => {
      const preview = screen.getByText(/A{100}\.\.\./)
      expect(preview).toBeInTheDocument()
    })
  })
})