import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchHistoryView } from '../SearchHistoryView'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'

// Mock VirtualList component
vi.mock('../../ui/virtual-list', () => ({
  VirtualList: ({ items, renderItem, onItemClick, selectedIndex }: any) => (
    <div data-testid="virtual-list" tabIndex={0}>
      {items.map((item: any, index: number) => {
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
  beforeEach(() => {
    // Set up mocks BEFORE render using setState
    useScratchPadStore.setState({
      notes: [mockNote1, mockNote2, mockNote3],
      setActiveNote: vi.fn(),
      setCurrentView: vi.fn(),
      expandedFolders: new Set(['recent', 'all-notes']),
      toggleFolder: vi.fn(),
      searchNotes: vi.fn().mockResolvedValue([]),
      loadMoreNotes: vi.fn(),
      hasMoreNotes: false,
      isLoadingMore: false,
      isLoading: false,
      error: null
    })
  })

  it('should render the search history view', async () => {
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText('Search & Browse')).toBeInTheDocument()
    })
  })

  it('should display back button', async () => {
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setCurrentView: mockSetCurrentView
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByTestId('arrow-left')).toBeInTheDocument()
    })
  })

  it('should handle back button click', async () => {
    const user = userEvent.setup()
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setCurrentView: mockSetCurrentView
    })
    
    render(<SearchHistoryView />)
    
    const backButton = await screen.findByTestId('arrow-left')
    await user.click(backButton.parentElement!)
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should display folder structure', async () => {
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Notes')).toBeInTheDocument()
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })
  })

  it('should show notes in virtual list', async () => {
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument()
    })
  })

  it('should handle note selection', async () => {
    const user = userEvent.setup()
    const mockSetActiveNote = vi.fn()
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setActiveNote: mockSetActiveNote,
      setCurrentView: mockSetCurrentView
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByTestId('virtual-list-item-0')).toBeInTheDocument()
    })
    
    const firstItem = screen.getByTestId('virtual-list-item-0')
    await user.click(firstItem)
    
    expect(mockSetActiveNote).toHaveBeenCalled()
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should handle folder toggle', async () => {
    const user = userEvent.setup()
    const mockToggleFolder = vi.fn()
    
    useScratchPadStore.setState({
      toggleFolder: mockToggleFolder
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Notes')).toBeInTheDocument()
    })
    
    const folderHeader = screen.getByText('Recent Notes')
    await user.click(folderHeader)
    
    expect(mockToggleFolder).toHaveBeenCalledWith('recent')
  })

  it('should show loading state', async () => {
    useScratchPadStore.setState({
      isLoading: true
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })

  it('should show error state', async () => {
    useScratchPadStore.setState({
      error: 'Test error message',
      isLoading: false
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it('should handle empty state', async () => {
    useScratchPadStore.setState({
      notes: [],
      isLoading: false,
      error: null
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText(/no notes/i)).toBeInTheDocument()
    })
  })

  it('should show load more button when more notes available', async () => {
    useScratchPadStore.setState({
      hasMoreNotes: true,
      isLoadingMore: false
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText(/load more/i)).toBeInTheDocument()
    })
  })

  it('should handle load more click', async () => {
    const user = userEvent.setup()
    const mockLoadMoreNotes = vi.fn()
    
    useScratchPadStore.setState({
      hasMoreNotes: true,
      isLoadingMore: false,
      loadMoreNotes: mockLoadMoreNotes
    })
    
    render(<SearchHistoryView />)
    
    const loadMoreButton = await screen.findByText(/load more/i)
    await user.click(loadMoreButton)
    
    expect(mockLoadMoreNotes).toHaveBeenCalled()
  })

  it('should show loading more state', async () => {
    useScratchPadStore.setState({
      hasMoreNotes: true,
      isLoadingMore: true
    })
    
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(<SearchHistoryView />)
    
    const virtualList = await screen.findByTestId('virtual-list')
    await user.click(virtualList) // Focus the virtual list
    await user.keyboard('{ArrowDown}')
    
    // Should handle keyboard events
    await waitFor(() => {
      expect(virtualList).toHaveFocus()
    })
  })

  it('should display note metadata correctly', async () => {
    render(<SearchHistoryView />)
    
    await waitFor(() => {
      // Should show word counts and timestamps
      expect(screen.getByText('6 words')).toBeInTheDocument()
      expect(screen.getByText('9 words')).toBeInTheDocument()
    })
  })

  it('should handle search functionality', async () => {
    const user = userEvent.setup()
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote1])
    
    useScratchPadStore.setState({
      searchNotes: mockSearchNotes
    })
    
    render(<SearchHistoryView />)
    
    const searchInput = await screen.findByPlaceholderText(/search notes/i)
    await user.type(searchInput, 'test')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
    })
  })
})