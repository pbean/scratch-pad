import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock toast hook
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

vi.mock('../../ui/toast', () => ({
  useToast: () => mockToast,
}))

const mockNote: Note = {
  id: 1,
  content: 'Test note content',
  format: 'plaintext',
  nickname: 'Test Note',
  path: '/test/path',
  is_favorite: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  search_content: 'Test note content',
  word_count: 3,
  language: 'en'
}

describe('CommandPalette', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset store state
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: false,
        setCommandPaletteOpen: vi.fn(),
        setCurrentView: vi.fn(),
        createNote: vi.fn(),
        getActiveNote: () => mockNote
      })
    })
    
    vi.mocked(invoke).mockClear()
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockToast.info.mockClear()
    mockToast.warning.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
  })

  it('should auto-focus input when opened', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toHaveFocus()
    })
  })

  it('should display all default commands', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    expect(screen.getByText('Search History')).toBeInTheDocument()
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Export Note')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  it('should display command descriptions', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    expect(screen.getByText('Search and browse your notes')).toBeInTheDocument()
    expect(screen.getByText('Create a new note')).toBeInTheDocument()
    expect(screen.getByText('Export current note to file')).toBeInTheDocument()
    expect(screen.getByText('Configure application settings')).toBeInTheDocument()
  })

  it('should display keyboard shortcuts', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument()
  })

  it('should filter commands based on search query', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'search')
    })
    
    expect(screen.getByText('Search History')).toBeInTheDocument()
    expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Export Note')).not.toBeInTheDocument()
  })

  it('should filter commands by description', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'browse')
    })
    
    expect(screen.getByText('Search History')).toBeInTheDocument()
    expect(screen.queryByText('New Note')).not.toBeInTheDocument()
  })

  it('should show "No commands found" when no matches', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'nonexistent')
    })
    
    expect(screen.getByText('No commands found')).toBeInTheDocument()
  })

  it('should close on Escape key', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should navigate with arrow keys', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // First command should be selected by default
    const firstCommand = screen.getByText('Search History').closest('.flex.items-center')
    expect(firstCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    
    // Navigate down
    await act(async () => {
      await user.keyboard('{ArrowDown}')
    })
    
    const secondCommand = screen.getByText('New Note').closest('.flex.items-center')
    expect(secondCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    expect(firstCommand).not.toHaveClass('bg-accent', 'text-accent-foreground')
  })

  it('should wrap navigation at boundaries', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // Navigate up from first item (should wrap to last)
    await act(async () => {
      await user.keyboard('{ArrowUp}')
    })
    
    const lastCommand = screen.getByText('Open Settings').closest('.flex.items-center')
    expect(lastCommand).toHaveClass('bg-accent', 'text-accent-foreground')
  })

  it('should execute command on Enter', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: true,
        setCurrentView: mockSetCurrentView,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.keyboard('{Enter}')
    })
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('search-history')
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should execute command on click', async () => {
    const mockCreateNote = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: true,
        createNote: mockCreateNote,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.click(screen.getByText('New Note'))
    })
    
    expect(mockCreateNote).toHaveBeenCalled()
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should handle export note command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.click(screen.getByText('Export Note'))
      // Wait for the invoke promise to resolve and any subsequent state updates
      await vi.waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('export_note', {
          note: mockNote,
          filePath: 'note_1.txt'
        })
      })
    })
    
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Note exported", 
        "Saved as note_1.txt"
      )
    })
  })

  it('should handle export note error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Export failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.click(screen.getByText('Export Note'))
    })
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to export note:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should handle export when no active note', async () => {
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: true,
        getActiveNote: () => undefined
      })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.click(screen.getByText('Export Note'))
    })
    
    expect(invoke).not.toHaveBeenCalled()
  })

  it('should open settings view', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    act(() => {
      useScratchPadStore.setState({
        isCommandPaletteOpen: true,
        setCurrentView: mockSetCurrentView,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      })
    })
    
    render(<CommandPalette />)
    
    await act(async () => {
      await user.click(screen.getByText('Open Settings'))
    })
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('settings')
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should reset query and selection when opened', async () => {
    const { rerender } = render(<CommandPalette />)
    
    // Open palette
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    rerender(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    expect(input).toHaveValue('')
    
    // First command should be selected
    const firstCommand = screen.getByText('Search History').closest('.flex.items-center')
    expect(firstCommand).toHaveClass('bg-accent', 'text-accent-foreground')
  })

  it('should reset selection when query changes', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // Navigate to second item
    await act(async () => {
      await user.keyboard('{ArrowDown}')
    })
    
    const secondCommand = screen.getByText('New Note').closest('.flex.items-center')
    expect(secondCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    
    // Type in search - should reset to first item in filtered results
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'export')
    })
    
    // Wait for the selection to reset and re-render
    await waitFor(() => {
      const firstVisibleCommand = screen.getByText('Export Note').closest('.flex.items-center')
      expect(firstVisibleCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    })
  })

  it('should render command icons', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // Icons should be present (we can't easily test the actual SVG content)
    const commandItems = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('text-muted-foreground') && 
      el.parentElement?.classList.contains('flex')
    )
    
    expect(commandItems.length).toBeGreaterThan(0)
  })

  it('should apply correct styling', () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const overlay = screen.getByPlaceholderText('Type a command or search...').closest('.fixed')
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'flex', 'items-start', 'justify-center', 'pt-[20vh]', 'z-50')
    
    const dialog = screen.getByPlaceholderText('Type a command or search...').closest('.bg-popover')
    expect(dialog).toHaveClass('bg-popover', 'border', 'border-border', 'rounded-lg', 'shadow-2xl', 'w-full', 'max-w-lg', 'mx-4')
  })

  it('should handle keyboard navigation with filtered results', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'export')
    })
    
    // Wait for filtering to complete
    await waitFor(() => {
      expect(screen.getByText('Export Note')).toBeInTheDocument()
    })
    
    // "Search History" and "New Note" should not be visible in filtered results
    expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Search History')).not.toBeInTheDocument()
    
    // First (and only) filtered result should be selected
    const exportCommand = screen.getByText('Export Note').closest('.flex.items-center')
    expect(exportCommand).toHaveClass('bg-accent', 'text-accent-foreground')
  })

  it('should handle case-insensitive filtering', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    await act(async () => {
      await user.type(input, 'SEARCH')
    })
    
    expect(screen.getByText('Search History')).toBeInTheDocument()
    expect(screen.queryByText('New Note')).not.toBeInTheDocument()
  })
})