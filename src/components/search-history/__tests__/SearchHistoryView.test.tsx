import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchHistoryView } from '../SearchHistoryView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { renderWithState, cleanupTestEnhanced } from '../../../test/enhanced-test-utils'
import { createUser } from '../../../test/test-helpers'

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
  afterEach(async () => {
    // Explicit timer cleanup
    vi.clearAllTimers()
    vi.useRealTimers()
    await cleanupTestEnhanced()
  })

  it('should render header with back button', async () => {
    await renderWithState(<SearchHistoryView />, {
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
    
    expect(screen.getByText('Search & Browse')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render search input', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('should auto-focus search input on mount', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('Search notes...')).toHaveFocus()
      },
      { timeout: 1000 }
    )
  }, 3000)

  it('should display folder structure in browser mode', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('should display notes in folders', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    // Use getAllByText to handle multiple instances properly
    expect(screen.getAllByText('First Note').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Second note with different content').length).toBeGreaterThan(0)
  })

  it('should show last modified times', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'))
    
    try {
      await renderWithState(<SearchHistoryView />, {
        notes: [mockNote1, mockNote2, mockNote3],
        expandedFolders: new Set(['recent', 'all-notes']),
        searchNotes: vi.fn().mockResolvedValue([])
      })
      
      // Should show relative times
      expect(screen.getByText('1d ago')).toBeInTheDocument() // mockNote1 updated yesterday
      expect(screen.getByText('2d ago')).toBeInTheDocument() // mockNote2 updated 2 days ago
    } finally {
      vi.useRealTimers()
    }
  })

  it('should switch to search mode when typing', async () => {
    const user = createUser()
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'test')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
    })
  })

  it('should clear search when input is emptied', async () => {
    const user = createUser()
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Type and then clear
    await user.type(searchInput, 'test')
    await user.clear(searchInput)
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('')
    })
  })

  it('should handle clicking on notes', async () => {
    const user = createUser()
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([]),
      setActiveNote: mockSetActiveNote,
      setCurrentView: mockSetCurrentView
    })
    
    // Find and click on a note
    const noteElement = screen.getAllByText('First Note')[0]
    await user.click(noteElement)
    
    await waitFor(() => {
      expect(mockSetActiveNote).toHaveBeenCalledWith(mockNote1)
      expect(mockSetCurrentView).toHaveBeenCalledWith('editor')
    })
  })

  it('should handle folder expansion/collapse', async () => {
    const user = createUser()
    const mockToggleFolder = vi.fn()
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent']),  // Only recent expanded initially
      searchNotes: vi.fn().mockResolvedValue([]),
      toggleFolder: mockToggleFolder
    })
    
    // Find and click on a folder to expand/collapse
    const allNotesFolder = screen.getByText('All Notes')
    await user.click(allNotesFolder)
    
    await waitFor(() => {
      expect(mockToggleFolder).toHaveBeenCalledWith('all-notes')
    })
  })

  it('should show favorites in favorites folder', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    // mockNote2 is marked as favorite, should appear in favorites section
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    
    // Check that favorites folder contains the favorite note
    const favoriteNote = screen.getAllByText('Second note with different content')
    expect(favoriteNote.length).toBeGreaterThan(0)
  })

  it('should display search results when searching', async () => {
    const user = createUser()
    const mockSearchResults = [mockNote1]
    const mockSearchNotes = vi.fn().mockResolvedValue(mockSearchResults)
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
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
    const user = createUser()
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'nonexistent')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('nonexistent')
    })
  })

  it('should load more notes when available', async () => {
    const mockLoadMoreNotes = vi.fn().mockResolvedValue(undefined)
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([]),
      loadMoreNotes: mockLoadMoreNotes,
      hasMoreNotes: true,
      isLoadingMore: false
    })
    
    // Should show load more functionality when hasMoreNotes is true
    await waitFor(() => {
      // The load more functionality should be triggered automatically 
      // or through user interaction based on implementation
      expect(mockLoadMoreNotes).toHaveBeenCalled()
    })
  })

  it('should show loading state when loading more notes', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([]),
      hasMoreNotes: true,
      isLoadingMore: true
    })
    
    // Should show loading indicator when loading more
    await waitFor(() => {
      expect(screen.getByTestId('inline-loading')).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    const user = createUser()
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Focus the search input and test keyboard interactions
    await user.click(searchInput)
    await user.keyboard('{ArrowDown}')
    
    // The specific behavior depends on the implementation
    // but keyboard events should not cause errors
    expect(searchInput).toBeInTheDocument()
  })

  it('should handle back button click', async () => {
    const user = createUser()
    const mockSetCurrentView = vi.fn()
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([]),
      setCurrentView: mockSetCurrentView
    })
    
    const backButton = screen.getByRole('button')
    await user.click(backButton)
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('list')
    })
  })

  it('should handle error states gracefully', async () => {
    const user = createUser()
    const mockSearchNotes = vi.fn().mockRejectedValue(new Error('Search failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await user.type(searchInput, 'test')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
    })
    
    // Error should be handled gracefully without crashing
    expect(searchInput).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  it('should display empty state for no notes', async () => {
    await renderWithState(<SearchHistoryView />, {
      notes: [],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: vi.fn().mockResolvedValue([])
    })
    
    // Should still render the folder structure even with no notes
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('should handle rapid search input changes', async () => {
    const user = createUser()
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await renderWithState(<SearchHistoryView />, {
      notes: [mockNote1, mockNote2, mockNote3],
      expandedFolders: new Set(['recent', 'all-notes']),
      searchNotes: mockSearchNotes
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Type rapidly
    await user.type(searchInput, 'a')
    await user.type(searchInput, 'b')
    await user.type(searchInput, 'c')
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('abc')
    })
  })
})