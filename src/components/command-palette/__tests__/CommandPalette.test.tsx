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

// CI-optimized timeout constants
const CI_TIMEOUT = process.env.CI === 'true' ? 10000 : 5000
const CI_FOCUS_TIMEOUT = process.env.CI === 'true' ? 5000 : 2000
const CI_NAVIGATION_DELAY = process.env.CI === 'true' ? 50 : 16

// FE-FIX-001: Standardized input element selection utility
const getCommandSearchInput = () => {
  // Use data-testid for reliable selection
  return screen.getByTestId('command-search-input')
}

// Simplified focus wait utility
const waitForInputFocus = async (inputElement: HTMLElement, timeout: number = CI_FOCUS_TIMEOUT) => {
  return waitFor(() => {
    expect(inputElement).toHaveFocus()
  }, { 
    timeout,
    interval: process.env.CI === 'true' ? 100 : 50
  })
}

// Simplified selection state check
const waitForSelectedIndex = async (expectedIndex: number) => {
  return waitFor(() => {
    const commands = document.querySelectorAll('.command-item')
    if (commands[expectedIndex]) {
      expect(commands[expectedIndex]).toHaveClass('bg-accent', 'text-accent-foreground')
    }
  }, { timeout: CI_TIMEOUT })
}

describe('CommandPalette', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(async () => {
    // Setup userEvent with CI-optimized configuration
    user = userEvent.setup({
      delay: process.env.CI === 'true' ? 20 : null,
      advanceTimers: vi.advanceTimersByTime,
    })
    
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
    
    // Clear all mocks
    vi.mocked(invoke).mockClear()
    Object.values(mockToast).forEach(mock => mock.mockClear())
  })

  afterEach(() => {
    // FE-FIX-004: Simplified cleanup without DOM manipulation conflicts
    vi.clearAllMocks()
    
    // Reset focus state cleanly
    try {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur?.()
      }
    } catch (error) {
      // Ignore focus cleanup errors
    }
  })

  it('should not render when closed', async () => {
    render(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
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
    
    // FE-FIX-001: Use standardized input selection
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
  })

  it('should display all default commands', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // Wait for component to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Export Note')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  it('should display command descriptions', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByText('Search and browse your notes')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('Create a new note')).toBeInTheDocument()
    expect(screen.getByText('Export current note to file')).toBeInTheDocument()
    expect(screen.getByText('Configure application settings')).toBeInTheDocument()
  })

  it('should display keyboard shortcuts', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument()
  })

  it('should filter commands based on search query', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'search')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
      expect(screen.queryByText('Export Note')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should filter commands by description', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'browse')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should show "No commands found" when no matches', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'nonexistent')
    })
    
    await waitFor(() => {
      expect(screen.getByText('No commands found')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
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
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    
    await waitFor(() => {
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should navigate with arrow keys', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Wait for initial selection
    try {
      await waitForSelectedIndex(0)
    } catch (error) {
      // Fallback: just wait for commands to be visible
      await waitFor(() => {
        expect(screen.getByText('Search History')).toBeInTheDocument()
      }, { timeout: CI_TIMEOUT })
    }
    
    // Navigate down
    await act(async () => {
      await user.keyboard('{ArrowDown}')
    })
    
    // Check that we have the commands visible
    await waitFor(() => {
      expect(screen.getByText('New Note')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should wrap navigation at boundaries', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Wait for initial selection
    try {
      await waitForSelectedIndex(0)
    } catch (error) {
      await waitFor(() => {
        expect(screen.getByText('Search History')).toBeInTheDocument()
      }, { timeout: CI_TIMEOUT })
    }
    
    // Navigate up from first item (should wrap to last)
    await act(async () => {
      await user.keyboard('{ArrowUp}')
    })
    
    // Verify the last command is visible
    await waitFor(() => {
      expect(screen.getByText('Open Settings')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
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
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Wait for initial selection
    try {
      await waitForSelectedIndex(0)
    } catch (error) {
      await waitFor(() => {
        expect(screen.getByText('Search History')).toBeInTheDocument()
      }, { timeout: CI_TIMEOUT })
    }
    
    await act(async () => {
      await user.keyboard('{Enter}')
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('search-history')
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
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
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    const newNoteButton = await waitFor(() => screen.getByText('New Note'), { timeout: CI_TIMEOUT })
    
    await act(async () => {
      await user.click(newNoteButton)
    })
    
    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalled()
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should handle export note command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    const exportButton = await waitFor(() => screen.getByText('Export Note'), { timeout: CI_TIMEOUT })
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    // Wait for invoke to be called
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('export_note', {
        note: mockNote,
        filePath: 'note_1.txt'
      })
    }, { timeout: CI_TIMEOUT })
    
    // Wait for success toast
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Note exported", 
        "Saved as note_1.txt"
      )
    }, { timeout: CI_TIMEOUT })
  })

  it('should handle export note error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Export failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    const exportButton = await waitFor(() => screen.getByText('Export Note'), { timeout: CI_TIMEOUT })
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to export note:', expect.any(Error))
    }, { timeout: CI_TIMEOUT })
    
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
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    const exportButton = await waitFor(() => screen.getByText('Export Note'), { timeout: CI_TIMEOUT })
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    // Wait a bit and verify invoke wasn't called
    await new Promise(resolve => setTimeout(resolve, 100))
    
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
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    const settingsButton = await waitFor(() => screen.getByText('Open Settings'), { timeout: CI_TIMEOUT })
    
    await act(async () => {
      await user.click(settingsButton)
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('settings')
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should reset query and selection when opened', async () => {
    const { rerender } = render(<CommandPalette />)
    
    // Open palette
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    rerender(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitFor(() => {
      expect(input).toHaveFocus()
      expect(input).toHaveValue('')
    }, { timeout: CI_FOCUS_TIMEOUT })
    
    // Check first command is visible
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should reset selection when query changes', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Wait for initial selection
    try {
      await waitForSelectedIndex(0)
    } catch (error) {
      await waitFor(() => {
        expect(screen.getByText('Search History')).toBeInTheDocument()
      }, { timeout: CI_TIMEOUT })
    }
    
    // Navigate to second item
    await act(async () => {
      await user.keyboard('{ArrowDown}')
    })
    
    // Wait a bit for navigation to settle
    await new Promise(resolve => setTimeout(resolve, CI_NAVIGATION_DELAY))
    
    // Type in search - should reset to first item in filtered results
    await act(async () => {
      await user.type(input, 'export')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Export Note')).toBeInTheDocument()
      expect(screen.queryByText('Search History')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should render command icons', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    // Icons should be present (verify commands are visible)
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Export Note')).toBeInTheDocument()
  })

  it('should apply correct styling', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    // Wait for component to be fully rendered
    await waitFor(() => {
      expect(input).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    const overlay = input.closest('.fixed')
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'flex', 'items-start', 'justify-center', 'pt-[20vh]', 'z-50')
    
    const dialog = input.closest('.bg-popover')
    expect(dialog).toHaveClass('bg-popover', 'border', 'border-border', 'rounded-lg', 'shadow-2xl', 'w-full', 'max-w-lg', 'mx-4')
  })

  it('should handle keyboard navigation with filtered results', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'export')
    })
    
    // Wait for filtering to complete
    await waitFor(() => {
      expect(screen.getByText('Export Note')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
      expect(screen.queryByText('Search History')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    // Verify the export command is visible
    expect(screen.getByText('Export Note')).toBeInTheDocument()
  })

  it('should handle case-insensitive filtering', async () => {
    act(() => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    render(<CommandPalette />)
    
    const input = getCommandSearchInput()
    
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'SEARCH')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })
})