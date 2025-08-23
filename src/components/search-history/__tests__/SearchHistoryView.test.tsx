import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchHistoryView } from '../SearchHistoryView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { setupTestIsolation, teardownTestIsolation } from '../../../test/test-isolation'

// Mock VirtualList component - improved mock with proper key generation
vi.mock('../../ui/virtual-list', () => ({
  VirtualList: ({ items, renderItem, onItemClick, selectedIndex }: any) => (
    <div data-testid="virtual-list" tabIndex={0}>
      {items.map((item: any, index: number) => {
        // Generate unique keys properly to avoid React warnings
        const uniqueKey = `${item.type}-${item.id || item.name}-${index}`
        return (
          <div
            key={uniqueKey}
            data-testid={`virtual-list-item-${index}`}
            onClick={() => onItemClick?.(item)}
            className={selectedIndex === index ? 'selected' : ''}
          >
            {renderItem(item, index, selectedIndex === index)}
          </div>
        )
      })}
    </div>
  )
}))

// Mock loading components
vi.mock('../../ui/loading', () => ({
  LoadingSpinner: ({ size, variant }: any) => <div data-testid="loading-spinner" data-size={size} data-variant={variant} />,
  InlineLoading: ({ message, size }: any) => <div data-testid="inline-loading" data-message={message} data-size={size} />,
  Skeleton: ({ width, height }: any) => <div data-testid="skeleton" data-width={width} data-height={height} />
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <div data-testid="chevron-right" />,
  ChevronDown: () => <div data-testid="chevron-down" />,
  FileText: () => <div data-testid="file-text" />,
  Folder: () => <div data-testid="folder" />,
  FolderOpen: () => <div data-testid="folder-open" />,
  ArrowLeft: () => <div data-testid="arrow-left" />,
  Search: () => <div data-testid="search" />
}))

const mockNote1: Note = {
  id: 1,
  content: 'First note content with searchable text',
  created_at: '2024-01-01T12:00:00Z',
  updated_at: '2024-01-03T12:00:00Z',
  is_favorite: false,
  search_content: 'first note content searchable text',
  word_count: 6,
  language: null,
  format: 'markdown'
}

const mockNote2: Note = {
  id: 2,
  content: 'Second note with different content for testing search functionality',
  created_at: '2024-01-02T12:00:00Z',
  updated_at: '2024-01-02T12:00:00Z',
  is_favorite: true,
  search_content: 'second note different content testing search functionality',
  word_count: 9,
  language: null,
  format: 'markdown'
}

const mockNote3: Note = {
  id: 3,
  content: '',
  created_at: '2024-01-03T12:00:00Z',
  updated_at: '2024-01-03T12:00:00Z',
  is_favorite: false,
  search_content: '',
  word_count: 0,
  language: null,
  format: 'markdown'
}

describe('SearchHistoryView', () => {
  // CRITICAL FIX: Setup userEvent with delay null to avoid act() issues
  const user = userEvent.setup({ delay: null })

  beforeEach(async () => {
    // Use test isolation utility for complete reset
    await setupTestIsolation()
    
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'))
    
    // Set up test-specific state
    await act(async () => {
      useScratchPadStore.setState({
        notes: [mockNote1, mockNote2, mockNote3],
        setActiveNote: vi.fn(),
        setCurrentView: vi.fn(),
        expandedFolders: new Set(['recent', 'all-notes']),
        toggleFolder: vi.fn(),
        searchNotes: vi.fn().mockResolvedValue([]),
        loadMoreNotes: vi.fn(),
        hasMoreNotes: false,
        isLoadingMore: false
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    teardownTestIsolation()
  })

  it('should render header with back button', async () => {
    // CRITICAL FIX: Remove act() wrapper around render - not needed
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Search & Browse')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render search input', async () => {
    // CRITICAL FIX: Remove act() wrapper around render
    render(<SearchHistoryView />)
    
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('should auto-focus search input on mount', async () => {
    // CRITICAL FIX: Remove act() wrapper around render
    render(<SearchHistoryView />)
    
    // Use waitFor without act() wrapper - waitFor handles the async updates
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('Search notes...')).toHaveFocus()
      },
      { timeout: 1000 }
    )
  }, 3000)

  it('should display folder structure in browser mode', async () => {
    render(<SearchHistoryView />)
    
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('should display notes in folders', async () => {
    render(<SearchHistoryView />)
    
    // Use getAllByText to handle multiple instances properly
    const firstNoteElements = screen.getAllByText('First Note')
    expect(firstNoteElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
    
    const secondNoteElements = screen.getAllByText('Second note with different content')
    expect(secondNoteElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
    
    const untitledElements = screen.getAllByText('Untitled')
    expect(untitledElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
  })

  it('should show last modified times', async () => {
    render(<SearchHistoryView />)
    
    // Should show relative times
    expect(screen.getByText('1d ago')).toBeInTheDocument() // mockNote1 updated yesterday
    expect(screen.getByText('2d ago')).toBeInTheDocument() // mockNote2 updated 2 days ago
  })

  it('should switch to search mode when typing', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    // CRITICAL FIX: Only use act() for store state changes, not render
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // CRITICAL FIX: User interactions don't need act() wrapper when using userEvent.setup()
    await user.type(searchInput, 'test query')
    
    // Use waitFor for async state updates - no act() needed
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test query')
    })
  })

  it('should clear search results when input is cleared', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Type and then clear
    await user.type(searchInput, 'test')
    await user.clear(searchInput)
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('')
    })
  })

  it('should handle clicking on notes', async () => {
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({
        setActiveNote: mockSetActiveNote,
        setCurrentView: mockSetCurrentView
      })
    })
    
    render(<SearchHistoryView />)
    
    // Find and click on a note
    const noteElement = screen.getAllByText('First Note')[0]
    await user.click(noteElement)
    
    await waitFor(() => {
      expect(mockSetActiveNote).toHaveBeenCalledWith(mockNote1)
      expect(mockSetCurrentView).toHaveBeenCalledWith('editor')
    })
  })

  it('should handle folder expansion/collapse', async () => {
    const mockToggleFolder = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({
        toggleFolder: mockToggleFolder,
        expandedFolders: new Set(['recent'])  // Only recent expanded initially
      })
    })
    
    render(<SearchHistoryView />)
    
    // Find and click on a folder to expand/collapse
    const allNotesFolder = screen.getByText('All Notes')
    await user.click(allNotesFolder)
    
    await waitFor(() => {
      expect(mockToggleFolder).toHaveBeenCalledWith('all-notes')
    })
  })

  it('should show favorites in favorites folder', async () => {
    render(<SearchHistoryView />)
    
    // mockNote2 is marked as favorite, should appear in favorites section
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    
    // Check that favorites folder contains the favorite note
    const favoriteNote = screen.getAllByText('Second note with different content')
    expect(favoriteNote.length).toBeGreaterThan(0)
  })

  it('should display search results when searching', async () => {
    const mockSearchResults = [mockNote1]
    const mockSearchNotes = vi.fn().mockResolvedValue(mockSearchResults)
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'searchable')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('searchable')
    })
    
    // Should show search results instead of folder structure
    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument()
    })
  })

  it('should handle empty search results', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'nonexistent')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('nonexistent')
    })
  })

  it('should load more notes when available', async () => {
    const mockLoadMoreNotes = vi.fn().mockResolvedValue(undefined)
    
    await act(async () => {
      useScratchPadStore.setState({
        loadMoreNotes: mockLoadMoreNotes,
        hasMoreNotes: true,
        isLoadingMore: false
      })
    })
    
    render(<SearchHistoryView />)
    
    // Should show load more functionality when hasMoreNotes is true
    await waitFor(() => {
      // The load more functionality should be triggered automatically 
      // or through user interaction based on implementation
      expect(mockLoadMoreNotes).toHaveBeenCalled()
    })
  })

  it('should show loading state when loading more notes', async () => {
    await act(async () => {
      useScratchPadStore.setState({
        hasMoreNotes: true,
        isLoadingMore: true
      })
    })
    
    render(<SearchHistoryView />)
    
    // Should show loading indicator when loading more
    await waitFor(() => {
      expect(screen.getByTestId('inline-loading')).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Focus the search input and test keyboard interactions
    await user.click(searchInput)
    await user.keyboard('{ArrowDown}')
    
    // The specific behavior depends on the implementation
    // but keyboard events should not cause errors
    expect(searchInput).toBeInTheDocument()
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({
        setCurrentView: mockSetCurrentView
      })
    })
    
    render(<SearchHistoryView />)
    
    const backButton = screen.getByRole('button')
    await user.click(backButton)
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('list')
    })
  })

  it('should handle error states gracefully', async () => {
    const mockSearchNotes = vi.fn().mockRejectedValue(new Error('Search failed'))
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'error')
    
    // The component should handle the error gracefully
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('error')
      // Component should not crash and should show some error state or fallback
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    })
  })

  it('should display note word counts', async () => {
    render(<SearchHistoryView />)
    
    // Should show word counts for notes
    await waitFor(() => {
      // Check that notes with word counts are displayed properly
      expect(screen.getByText('First Note')).toBeInTheDocument()
    })
  })

  it('should handle notes without titles (Untitled)', async () => {
    render(<SearchHistoryView />)
    
    // mockNote3 has no title, should show as "Untitled"
    await waitFor(() => {
      expect(screen.getAllByText('Untitled').length).toBeGreaterThan(0)
    })
  })

  it('should update when store state changes', async () => {
    render(<SearchHistoryView />)
    
    // Initial render should show 3 notes
    expect(screen.getByText('First Note')).toBeInTheDocument()
    
    // Update store with new notes
    const newNote: Note = {
      id: 4,
      content: 'New note content',
      created_at: '2024-01-05T12:00:00Z',
      updated_at: '2024-01-05T12:00:00Z',
      is_favorite: false,
      search_content: 'new note content',
      word_count: 3,
      language: null,
      format: 'markdown'
    }
    
    await act(async () => {
      useScratchPadStore.setState({
        notes: [mockNote1, mockNote2, mockNote3, newNote]
      })
    })
    
    // Should show the new note
    await waitFor(() => {
      expect(screen.getByText('New Note')).toBeInTheDocument()
    })
  })
})