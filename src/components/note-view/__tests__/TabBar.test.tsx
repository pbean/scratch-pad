import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { TabBar } from '../TabBar'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { setupTestIsolation, teardownTestIsolation } from '../../../test/test-isolation'

const mockNote1: Note = {
  id: 1,
  content: 'First note content with a long title that should be truncated',
  format: 'plaintext',
  nickname: 'First Note',
  path: '/test/path1',
  is_favorite: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  search_content: 'First note content with a long title that should be truncated',
  word_count: 12,
  language: 'en'
}

const mockNote2: Note = {
  id: 2,
  content: 'Second note content',
  format: 'plaintext',
  nickname: undefined,
  path: '/test/path2',
  is_favorite: true,
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  search_content: 'Second note content',
  word_count: 3,
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
  updated_at: '2024-01-03T00:00:00Z',
  search_content: '',
  word_count: 0,
  language: null
}

describe('TabBar', () => {
  beforeEach(async () => {
    // Use test isolation utility for complete reset
    await setupTestIsolation()
    
    // Reset store state
    useScratchPadStore.setState({
      notes: [mockNote1, mockNote2, mockNote3],
      activeNoteId: 1,
      setActiveNote: vi.fn(),
      deleteNote: vi.fn()
    })
  })

  afterEach(() => {
    cleanup()
    teardownTestIsolation()
  })

  it('should render all note tabs', () => {
    render(<TabBar />)
    
    expect(screen.getByText('First Note')).toBeInTheDocument()
    expect(screen.getByText('Second note content')).toBeInTheDocument()
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('should highlight active tab', () => {
    render(<TabBar />)
    
    const activeTab = screen.getByText('First Note').closest('div')
    const inactiveTab = screen.getByText('Second note content').closest('div')
    
    expect(activeTab).toHaveClass('bg-background', 'text-foreground')
    expect(inactiveTab).toHaveClass('bg-muted/50', 'text-muted-foreground')
  })

  it('should switch active note when tab is clicked', async () => {
    const user = userEvent.setup()
    const mockSetActiveNote = vi.fn()
    useScratchPadStore.setState({ setActiveNote: mockSetActiveNote })
    
    render(<TabBar />)
    
    const secondTab = screen.getByTestId('tab-2')
    expect(secondTab).toBeInTheDocument()
    
    await user.click(secondTab)
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(2)
  })

  it('should show close button for each tab when multiple notes exist', () => {
    render(<TabBar />)
    
    expect(screen.getByTestId('close-tab-1')).toBeInTheDocument()
    expect(screen.getByTestId('close-tab-2')).toBeInTheDocument()
    expect(screen.getByTestId('close-tab-3')).toBeInTheDocument()
  })

  it('should not show close button when only one note exists', () => {
    useScratchPadStore.setState({ notes: [mockNote1] })
    
    render(<TabBar />)
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should close tab when close button is clicked', async () => {
    const user = userEvent.setup()
    const mockDeleteNote = vi.fn()
    useScratchPadStore.setState({ deleteNote: mockDeleteNote })
    
    render(<TabBar />)
    
    const closeButton = screen.getByTestId('close-tab-2')
    await user.click(closeButton)
    
    expect(mockDeleteNote).toHaveBeenCalledWith(2)
  })

  it('should not switch tab when close button is clicked', async () => {
    const user = userEvent.setup()
    const mockSetActiveNote = vi.fn()
    const mockDeleteNote = vi.fn()
    
    useScratchPadStore.setState({
      setActiveNote: mockSetActiveNote,
      deleteNote: mockDeleteNote
    })
    
    render(<TabBar />)
    
    const closeButton = screen.getByTestId('close-tab-1')
    await user.click(closeButton)
    
    expect(mockDeleteNote).toHaveBeenCalledWith(1)
    expect(mockSetActiveNote).not.toHaveBeenCalled()
  })

  it('should use nickname as tab title when available', () => {
    render(<TabBar />)
    
    expect(screen.getByText('First Note')).toBeInTheDocument()
  })

  it('should use first line as tab title when no nickname', () => {
    render(<TabBar />)
    
    const secondTab = screen.getByTestId('tab-2')
    expect(secondTab).toBeInTheDocument()
    expect(secondTab).toHaveTextContent('Second note content')
  })

  it('should show "Untitled" when no content and no nickname', () => {
    render(<TabBar />)
    
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('should truncate long titles', () => {
    const longNote = {
      ...mockNote1,
      nickname: undefined,
      content: 'This is a very long note title that should definitely be truncated because it exceeds the maximum length'
    }
    
    useScratchPadStore.setState({ notes: [longNote] })
    
    render(<TabBar />)
    
    const tabText = screen.getByText(/This is a very long note title/)
    expect(tabText.textContent).toHaveLength(30) // Should be truncated to 30 chars
  })

  it('should handle empty notes array', () => {
    useScratchPadStore.setState({ notes: [] })
    
    render(<TabBar />)
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // When notes array is empty, no tab content should be rendered
    expect(screen.queryByText('First Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Second note content')).not.toBeInTheDocument()
    expect(screen.queryByText('Untitled')).not.toBeInTheDocument()
  })

  it('should apply correct CSS classes', () => {
    render(<TabBar />)
    
    const tabBar = screen.getByText('First Note').closest('div')?.parentElement
    expect(tabBar).toHaveClass('flex', 'border-b', 'border-border', 'bg-muted/30')
    
    const activeTab = screen.getByText('First Note').closest('div')
    expect(activeTab).toHaveClass(
      'flex',
      'items-center',
      'gap-2',
      'px-4',
      'py-2',
      'cursor-pointer',
      'border-r',
      'border-border',
      'min-w-0',
      'max-w-48'
    )
  })

  it('should handle hover states', async () => {
    const user = userEvent.setup()
    render(<TabBar />)
    
    const inactiveTab = screen.getByText('Second note content').closest('div')
    
    await user.hover(inactiveTab!)
    
    expect(inactiveTab).toHaveClass('hover:bg-muted')
  })

  it('should maintain tab order', () => {
    render(<TabBar />)
    
    const tabs = screen.getAllByText(/First Note|Second note content|Untitled/)
    
    expect(tabs[0]).toHaveTextContent('First Note')
    expect(tabs[1]).toHaveTextContent('Second note content')
    expect(tabs[2]).toHaveTextContent('Untitled')
  })

  it('should handle different active note IDs', () => {
    useScratchPadStore.setState({ activeNoteId: 3 })
    
    render(<TabBar />)
    
    const activeTab = screen.getByText('Untitled').closest('div')
    const inactiveTab = screen.getByText('First Note').closest('div')
    
    expect(activeTab).toHaveClass('bg-background', 'text-foreground')
    expect(inactiveTab).toHaveClass('bg-muted/50', 'text-muted-foreground')
  })

  it('should handle null active note ID', () => {
    useScratchPadStore.setState({ activeNoteId: null })
    
    render(<TabBar />)
    
    // All tabs should be inactive
    const tabs = screen.getAllByText(/First Note|Second note content|Untitled/)
    tabs.forEach(tab => {
      const tabDiv = tab.closest('div')
      expect(tabDiv).toHaveClass('bg-muted/50', 'text-muted-foreground')
    })
  })

  it('should render close button with correct icon', () => {
    render(<TabBar />)
    
    const closeButtons = screen.getAllByRole('button')
    closeButtons.forEach(button => {
      expect(button).toHaveClass('p-1', 'hover:bg-muted-foreground/20', 'rounded')
    })
  })
})