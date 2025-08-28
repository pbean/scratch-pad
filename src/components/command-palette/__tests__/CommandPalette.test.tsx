import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search" />,
  FileText: () => <div data-testid="file-text" />,
  Settings: () => <div data-testid="settings" />,
  Download: () => <div data-testid="download" />,
  FolderOpen: () => <div data-testid="folder-open" />,
  Plus: () => <div data-testid="plus" />,
  Moon: () => <div data-testid="moon" />,
  Sun: () => <div data-testid="sun" />
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
  updated_at: '2024-01-01T00:00:00Z'
}

describe('CommandPalette', () => {
  let user: Awaited<ReturnType<typeof userEvent.setup>>

  beforeEach(async () => {
    // Configure userEvent with pointerEventsCheck disabled
    user = await userEvent.setup({
      pointerEventsCheck: 0
    })
    
    // Complete store initialization with ALL properties for React 19
    useScratchPadStore.setState({
      // UI State
      currentView: 'note',
      isCommandPaletteOpen: false,
      expandedFolders: new Set(),
      theme: 'light',
      
      // Notes State
      notes: [mockNote],
      activeNoteId: 1,
      noteContents: { 1: 'Test note content' },
      isLoading: false,
      
      // Search State
      searchQuery: '',
      searchResults: [],
      searchHistory: [],
      
      // System State
      error: null,
      
      // Actions - Command Palette specific
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn(),
      getActiveNote: () => mockNote,
      setError: vi.fn(),
      
      // Other required actions
      loadNotes: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      setActiveNoteId: vi.fn(),
      updateNoteContent: vi.fn(),
      searchNotes: vi.fn(),
      addToSearchHistory: vi.fn(),
      clearSearchHistory: vi.fn(),
      toggleFolder: vi.fn(),
      getAllSettings: vi.fn(),
      setSetting: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn()
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

  it('should render when open', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Use findBy for async element discovery in React 19
    const input = await screen.findByPlaceholderText('Type a command or search...')
    expect(input).toBeInTheDocument()
  })

  it('should auto-focus input when opened', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // React 19 async focus pattern with extended timeout
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Type a command or search...')
      expect(input).toHaveFocus()
    }, { timeout: 2000 })
  })

  it('should display all default commands', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Use findBy for async command discovery
    await screen.findByText('Search History')
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Export Note')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  it('should display command descriptions', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for async command loading
    await screen.findByText('Search and browse your notes')
    expect(screen.getByText('Create a new note')).toBeInTheDocument()
    expect(screen.getByText('Export current note to file')).toBeInTheDocument()
    expect(screen.getByText('Configure application settings')).toBeInTheDocument()
  })

  it('should display keyboard shortcuts', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Use async pattern for keyboard shortcuts
    await screen.findByText('Ctrl+Shift+F')
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument()
  })

  it('should filter commands based on search query', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'search')
    
    // Wait for filtering to complete with React 19
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
      expect(screen.queryByText('Export Note')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should filter commands by description', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'browse')
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should show "No commands found" when no matches', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'nonexistent')
    
    await waitFor(() => {
      expect(screen.getByText('No commands found')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should close on Escape key', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    // Wait for component to be ready
    await screen.findByPlaceholderText('Type a command or search...')
    
    await user.keyboard('{Escape}')
    
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should navigate with arrow keys', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for commands to render
    await screen.findByText('Search History')
    
    // First command should be selected by default - use findBy for async elements
    const firstCommand = await screen.findByText('Search History')
    const firstCommandContainer = firstCommand.closest('.flex.items-center')
    
    await waitFor(() => {
      expect(firstCommandContainer).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
    
    // Navigate down
    await user.keyboard('{ArrowDown}')
    
    await waitFor(() => {
      const secondCommand = screen.getByText('New Note').closest('.flex.items-center')
      expect(secondCommand).toHaveClass('bg-accent', 'text-accent-foreground')
      expect(firstCommandContainer).not.toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
  })

  it('should wrap navigation at boundaries', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for commands to load
    await screen.findByText('Search History')
    
    // Navigate up from first item (should wrap to last)
    await user.keyboard('{ArrowUp}')
    
    await waitFor(() => {
      const lastCommand = screen.getByText('Open Settings').closest('.flex.items-center')
      expect(lastCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
  })

  it('should execute command on Enter', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCurrentView: mockSetCurrentView,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    // Wait for component to be ready
    await screen.findByText('Search History')
    
    await user.keyboard('{Enter}')
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('search-history')
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should execute command on click', async () => {
    const mockCreateNote = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      createNote: mockCreateNote,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    const newNoteCommand = await screen.findByText('New Note')
    await user.click(newNoteCommand)
    
    expect(mockCreateNote).toHaveBeenCalled()
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should handle export note command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const exportCommand = await screen.findByText('Export Note')
    await user.click(exportCommand)
    
    // Wait for async command execution with React 19
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('export_note', {
        note: mockNote,
        filePath: 'note_1.txt'
      })
    }, { timeout: 2000 })
    
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Note exported", 
        "Saved as note_1.txt"
      )
    }, { timeout: 2000 })
  })

  it('should handle export note error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Export failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const exportCommand = await screen.findByText('Export Note')
    await user.click(exportCommand)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to export note:', expect.any(Error))
    }, { timeout: 2000 })
    
    consoleSpy.mockRestore()
  })

  it('should handle export when no active note', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      getActiveNote: () => undefined
    })
    
    render(<CommandPalette />)
    
    const exportCommand = await screen.findByText('Export Note')
    await user.click(exportCommand)
    
    // Should not invoke export without active note
    expect(invoke).not.toHaveBeenCalled()
  })

  it('should open settings view', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCurrentView: mockSetCurrentView,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    const settingsCommand = await screen.findByText('Open Settings')
    await user.click(settingsCommand)
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('settings')
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should reset query and selection when opened', async () => {
    const { rerender } = render(<CommandPalette />)
    
    // Open palette
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    rerender(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    expect(input).toHaveValue('')
    
    // Wait for first command to be selected
    await waitFor(() => {
      const firstCommand = screen.getByText('Search History').closest('.flex.items-center')
      expect(firstCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
  })

  it('should reset selection when query changes', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for initial render
    await screen.findByText('Search History')
    
    // Navigate to second item
    await user.keyboard('{ArrowDown}')
    
    await waitFor(() => {
      const secondCommand = screen.getByText('New Note').closest('.flex.items-center')
      expect(secondCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
    
    // Type in search - should reset to first item in filtered results
    const input = screen.getByPlaceholderText('Type a command or search...')
    await user.type(input, 'export')
    
    // Wait for the selection to reset and re-render with React 19
    await waitFor(() => {
      const firstVisibleCommand = screen.getByText('Export Note').closest('.flex.items-center')
      expect(firstVisibleCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
  })

  it('should render command icons', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for commands to render
    await screen.findByText('Search History')
    
    // Icons should be present - check for icon test ids from mocked lucide-react
    const searchIcon = screen.getByTestId('search')
    const fileTextIcon = screen.getByTestId('file-text')
    const settingsIcon = screen.getByTestId('settings')
    
    expect(searchIcon).toBeInTheDocument()
    expect(fileTextIcon).toBeInTheDocument()
    expect(settingsIcon).toBeInTheDocument()
  })

  it('should apply correct styling', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    
    const overlay = input.closest('.fixed')
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'flex', 'items-start', 'justify-center', 'pt-[20vh]', 'z-50')
    
    const dialog = input.closest('.bg-popover')
    expect(dialog).toHaveClass('bg-popover', 'border', 'border-border', 'rounded-lg', 'shadow-2xl', 'w-full', 'max-w-lg', 'mx-4')
  })

  it('should handle keyboard navigation with filtered results', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'export')
    
    // Wait for filtering to complete with React 19
    await waitFor(() => {
      expect(screen.getByText('Export Note')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // "Search History" and "New Note" should not be visible in filtered results
    expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Search History')).not.toBeInTheDocument()
    
    // First (and only) filtered result should be selected
    await waitFor(() => {
      const exportCommand = screen.getByText('Export Note').closest('.flex.items-center')
      expect(exportCommand).toHaveClass('bg-accent', 'text-accent-foreground')
    }, { timeout: 2000 })
  })

  it('should handle case-insensitive filtering', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'SEARCH')
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })
})