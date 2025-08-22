import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchHistoryView } from '../SearchHistoryView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'

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
  format: 'plaintext',
  nickname: 'First Note',
  path: '/test/path1',
  is_favorite: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z',
  search_content: 'First note content with searchable text',
  word_count: 7,
  language: 'en'
}

const mockNote2: Note = {
  id: 2,
  content: 'Second note with different content',
  format: 'plaintext',
  nickname: undefined,
  path: '/test/path2',
  is_favorite: false,
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T08:00:00Z',
  search_content: 'Second note with different content',
  word_count: 6,
  language: 'en'
}

const mockNote3: Note = {
  id: 3,
  content: '',
  format: 'markdown',
  nickname: undefined,
  path: '/test/path3',
  is_favorite: false,
  created_at: '2024-01-03T00:00:00Z',
  updated_at: '2024-01-03T16:00:00Z',
  search_content: '',
  word_count: 0,
  language: null
}

describe('SearchHistoryView', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-04T12:00:00Z'))
    
    // Reset store state with all required properties
    act(() => {
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
    vi.clearAllMocks()
  })

  it('should render header with back button', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    expect(screen.getByText('Search & Browse')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render search input', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
  })

  it('should auto-focus search input on mount', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('Search notes...')).toHaveFocus()
      },
      { timeout: 1000 }
    )
  }, 3000)

  it('should display folder structure in browser mode', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('All Notes')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
  })

  it('should display notes in folders', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    // Use getAllByText to handle multiple instances properly
    const firstNoteElements = screen.getAllByText('First Note')
    expect(firstNoteElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
    
    const secondNoteElements = screen.getAllByText('Second note with different content')
    expect(secondNoteElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
    
    const untitledElements = screen.getAllByText('Untitled')
    expect(untitledElements.length).toBeGreaterThanOrEqual(1) // May appear in multiple folders
  })

  it('should show last modified times', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    // Should show relative times
    expect(screen.getByText('1d ago')).toBeInTheDocument() // mockNote1 updated yesterday
    expect(screen.getByText('2d ago')).toBeInTheDocument() // mockNote2 updated 2 days ago
  })

  it('should switch to search mode when typing', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'searchable')
    })
    
    // Fast-forward past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('searchable')
    })
  })

  it('should display search results', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'first')
    })
    
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument()
      // Should show content preview in search mode
      expect(screen.getByText(/First note content with searchable text/)).toBeInTheDocument()
    })
  })

  it('should debounce search queries', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Type multiple characters quickly
    await act(async () => {
      await user.type(searchInput, 'test')
    })
    
    // Should not call search immediately
    expect(mockSearchNotes).not.toHaveBeenCalled()
    
    // Fast-forward past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
      expect(mockSearchNotes).toHaveBeenCalledTimes(1)
    })
  })

  it('should handle keyboard navigation', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    // First item should be selected by default
    const virtualList = screen.getByTestId('virtual-list')
    expect(virtualList).toBeInTheDocument()
    
    // Note: Detailed keyboard navigation testing would require more complex mocking
    // of the VirtualList component's internal state
  })

  it('should expand/collapse folders with Enter key', async () => {
    const mockToggleFolder = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({ toggleFolder: mockToggleFolder })
      render(<SearchHistoryView />)
    })
    
    // Get the component container and focus it first
    const container = screen.getByTestId('virtual-list')
    container.focus()
    
    // Navigate to a folder and press Enter
    await act(async () => {
      await user.keyboard('{Enter}')
    })
    
    await waitFor(() => {
      expect(mockToggleFolder).toHaveBeenCalledWith('recent')
    }, { timeout: 2000 })
  }, 5000)

  it('should open note with Enter key', async () => {
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({
        setActiveNote: mockSetActiveNote,
        setCurrentView: mockSetCurrentView
      })
      render(<SearchHistoryView />)
    })
    
    // Get the component container and focus it first
    const container = screen.getByTestId('virtual-list')
    container.focus()
    
    // Navigate to a note (skip folders)
    await act(async () => {
      await user.keyboard('{ArrowDown}') // All Notes
      await user.keyboard('{ArrowDown}') // Favorites  
      await user.keyboard('{ArrowDown}') // First note under Recent
      await user.keyboard('{Enter}')
    })
    
    await waitFor(() => {
      expect(mockSetActiveNote).toHaveBeenCalledWith(1)
      expect(mockSetCurrentView).toHaveBeenCalledWith('note')
    }, { timeout: 2000 })
  }, 5000)

  it('should handle Escape key to go back to note view', async () => {
    const mockSetCurrentView = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
      render(<SearchHistoryView />)
    })
    
    // Get the component container and focus it first
    const container = screen.getByTestId('virtual-list')
    container.focus()
    
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('note')
    }, { timeout: 2000 })
  }, 5000)

  it('should clear search query with Escape when searching', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    
    // Focus the search input first
    searchInput.focus()
    
    await act(async () => {
      await user.type(searchInput, 'test query')
    })
    
    expect(searchInput).toHaveValue('test query')
    
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('')
    }, { timeout: 2000 })
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    await act(async () => {
      await user.click(screen.getByRole('button'))
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('note')
    }, { timeout: 2000 })
  })

  it('should show "No notes available" when no notes', async () => {
    await act(async () => {
      useScratchPadStore.setState({ notes: [] })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('No notes available')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should show "No notes found" in search mode with no results', async () => {
    const mockSearchNotes = vi.fn().mockResolvedValue([])
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'nonexistent')
    })
    
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    await waitFor(() => {
      expect(screen.getByText('No notes found')).toBeInTheDocument()
    })
  })

  it('should display correct footer information', async () => {
    await act(async () => {
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Use ↑↓ to navigate, Enter to open, ← → to expand/collapse')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should handle search errors gracefully', async () => {
    const mockSearchNotes = vi.fn().mockRejectedValue(new Error('Search failed'))
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'test')
    })
    
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
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
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'A')
    })
    
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    await waitFor(() => {
      const preview = screen.getByText(/A{100}\.\.\./)
      expect(preview).toBeInTheDocument()
    })
  })

  it('should show loading state during search', async () => {
    const mockSearchNotes = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))
    
    await act(async () => {
      useScratchPadStore.setState({ searchNotes: mockSearchNotes })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const searchInput = screen.getByPlaceholderText('Search notes...')
    await act(async () => {
      await user.type(searchInput, 'test')
    })
    
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    
    // Should show loading spinner
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    
    // Complete the search
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
  })

  it('should handle load more notes', async () => {
    const mockLoadMoreNotes = vi.fn()
    
    await act(async () => {
      useScratchPadStore.setState({
        hasMoreNotes: true,
        isLoadingMore: false,
        loadMoreNotes: mockLoadMoreNotes
      })
      render(<SearchHistoryView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Load More Notes')).toBeInTheDocument()
    }, { timeout: 1000 })
    
    const loadMoreButton = screen.getByText('Load More Notes')
    await act(async () => {
      await user.click(loadMoreButton)
    })
    
    expect(mockLoadMoreNotes).toHaveBeenCalled()
  })
})