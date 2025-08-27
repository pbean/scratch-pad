import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'

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

describe('CommandPalette', () => {
  beforeEach(() => {
    // CRITICAL: Reset all mock calls
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockToast.info.mockClear()
    mockToast.warning.mockClear()

    // COMPREHENSIVE STORE STATE SETUP - All methods that CommandPalette actually uses
    useScratchPadStore.setState({
      // Core command palette state
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: vi.fn(),
      
      // Navigation methods (REQUIRED)
      setCurrentView: vi.fn(),
      
      // Note management (REQUIRED)
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({
        id: 1,
        content: 'Test note content',
        nickname: 'Test Note'
      }),
      
      // Search state (used in filtering)
      searchQuery: '',
      searchResults: [],
      notes: [],
      
      // Error handling
      error: null,
      setError: vi.fn()
    })
  })

  it('should render when open', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('command-search-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('should focus input when opened', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    await waitFor(() => {
      const input = screen.getByTestId('command-search-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveFocus()
    }, { timeout: 5000 })
  })

  it('should filter commands based on input', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    const input = await screen.findByTestId('command-search-input')
    
    await act(async () => {
      await userEvent.type(input, 'new')
    })

    await waitFor(() => {
      // Should show filtered commands containing "new"
      expect(screen.getByTestId('command-item-new-note')).toBeInTheDocument()
      // Should not show unrelated commands
      expect(screen.queryByTestId('command-item-settings')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle keyboard navigation between commands', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    const input = await screen.findByTestId('command-search-input')
    
    // Test arrow down navigation
    await act(async () => {
      input.focus()
      await userEvent.keyboard('{ArrowDown}')
    })

    await waitFor(() => {
      // Second command should be selected (first is selected by default, arrow down moves to second)
      const secondCommand = screen.getByTestId('command-item-new-note')
      expect(secondCommand).toHaveClass('bg-accent')
    }, { timeout: 3000 })
  })

  it('should handle Enter key on selected command', async () => {
    const mockSetCurrentView = vi.fn()
    const mockCreateNote = vi.fn().mockResolvedValue({ id: 1, content: 'New note' })
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: mockSetCurrentView,
      createNote: mockCreateNote,
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    const input = await screen.findByTestId('command-search-input')
    
    // Navigate to "New Note" command and press Enter
    await act(async () => {
      input.focus()
      await userEvent.keyboard('{ArrowDown}') // Move to "New Note"
      await userEvent.keyboard('{Enter}')
    })

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('should not render when closed', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn(),
      getActiveNote: vi.fn()
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    // Should not render anything when closed
    expect(screen.queryByTestId('command-search-input')).not.toBeInTheDocument()
  })

  it('should show all commands initially', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: vi.fn(),
      createNote: vi.fn().mockResolvedValue({ id: 1, content: 'New note' }),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    await waitFor(() => {
      // Check for key commands that should be present
      expect(screen.getByTestId('command-item-search-history')).toBeInTheDocument()
      expect(screen.getByTestId('command-item-new-note')).toBeInTheDocument()
      expect(screen.getByTestId('command-item-settings')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle escape key to close', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: mockSetCommandPaletteOpen,
      setCurrentView: vi.fn(),
      createNote: vi.fn(),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    const input = await screen.findByTestId('command-search-input')
    
    await act(async () => {
      input.focus()
      await userEvent.keyboard('{Escape}')
    })

    await waitFor(() => {
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: 3000 })
  })

  it('should handle command clicks', async () => {
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: vi.fn(),
      setCurrentView: mockSetCurrentView,
      createNote: vi.fn(),
      getActiveNote: vi.fn().mockReturnValue({ id: 1, content: 'Test note' })
    })

    await act(async () => {
      render(<CommandPalette />)
    })

    const settingsCommand = await screen.findByTestId('command-item-settings')
    
    await act(async () => {
      await userEvent.click(settingsCommand)
    })

    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('settings')
    }, { timeout: 3000 })
  })
})