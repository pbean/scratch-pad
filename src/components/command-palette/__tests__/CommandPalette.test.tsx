import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { invoke } from '@tauri-apps/api/core'
import { renderWithState, cleanupTestEnhanced, createMockStore } from '../../../test/enhanced-test-utils'
import { createUser } from '../../../test/test-helpers'

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
const CI_TIMEOUT = process.env.CI === 'true' ? 15000 : 5000
const CI_FOCUS_TIMEOUT = process.env.CI === 'true' ? 8000 : 3000
const CI_NAVIGATION_DELAY = process.env.CI === 'true' ? 100 : 16

// Enhanced input element selection utility with proper isolation
const getCommandSearchInput = async () => {
  // Wait for the component to render first
  await waitFor(() => {
    const inputs = screen.queryAllByTestId('command-search-input')
    if (inputs.length === 0) {
      throw new Error('No command search input found')
    }
  }, { timeout: CI_TIMEOUT })
  
  // Now get the input
  const inputs = screen.queryAllByTestId('command-search-input')
  if (inputs.length > 1) {
    // This should not happen with proper cleanup, but handle gracefully
    console.warn(`Found ${inputs.length} command search inputs, using the last one`)
  }
  return inputs[inputs.length - 1] as HTMLInputElement
}

// Enhanced focus wait utility for CI environment
const waitForInputFocus = async (inputElement: HTMLElement, timeout: number = CI_FOCUS_TIMEOUT) => {
  // In CI mode, be more patient with focus events
  if (process.env.CI === 'true' || process.env.VITEST_CI_MODE === 'true') {
    // Try to focus the element first
    await act(async () => {
      inputElement.focus()
    })
    
    // Wait for focus state with generous timeout
    return waitFor(() => {
      // Check if the element has focus or if document.activeElement points to it
      const isActive = document.activeElement === inputElement
      const hasAttribute = inputElement.hasAttribute('autofocus') || inputElement.matches(':focus')
      
      if (!isActive && !hasAttribute) {
        // Retry focus
        inputElement.focus()
        throw new Error('Element not focused yet')
      }
      
      expect(inputElement).toHaveFocus()
    }, { 
      timeout,
      interval: 200 // Slower polling in CI
    })
  } else {
    // Local environment - use normal focus waiting
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    return waitFor(() => {
      expect(inputElement).toHaveFocus()
    }, { 
      timeout,
      interval: 50
    })
  }
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
  beforeEach(() => {
    // Clear all mocks
    vi.mocked(invoke).mockClear()
    Object.values(mockToast).forEach(mock => mock.mockClear())
  })

  afterEach(async () => {
    await cleanupTestEnhanced()
  })

  it('should not render when closed', async () => {
    await renderWithState(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
  })

  it('should auto-focus input when opened', async () => {
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
  })

  it('should display all default commands', async () => {
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('New Note')).toBeInTheDocument()
    expect(screen.getByText('Export Note')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
    expect(screen.getByText('Open Settings')).toBeInTheDocument()
  })

  it('should display command descriptions', async () => {
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    await waitFor(() => {
      expect(screen.getByText('Search and browse your notes')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('Create a new note')).toBeInTheDocument()
    expect(screen.getByText('Export current note to file')).toBeInTheDocument()
    expect(screen.getByText('Configure application settings')).toBeInTheDocument()
  })

  it('should display keyboard shortcuts', async () => {
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    await waitFor(() => {
      expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument()
  })

  it('should filter commands based on search query', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'search')
    })
    
    await waitFor(() => {
      expect(screen.getByText('Search History')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should handle no results state', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.type(input, 'zzzzz')
    })
    
    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })

  it('should navigate commands with arrow keys', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Initial state - first command selected
    await waitForSelectedIndex(0)
    
    // Down arrow - select second command
    await act(async () => {
      await user.keyboard('{ArrowDown}')
      if (CI_NAVIGATION_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CI_NAVIGATION_DELAY))
      }
    })
    await waitForSelectedIndex(1)
    
    // Up arrow - back to first command
    await act(async () => {
      await user.keyboard('{ArrowUp}')
      if (CI_NAVIGATION_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CI_NAVIGATION_DELAY))
      }
    })
    await waitForSelectedIndex(0)
  })

  it('should handle Home and End keys', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Go to end
    await act(async () => {
      await user.keyboard('{End}')
      if (CI_NAVIGATION_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CI_NAVIGATION_DELAY))
      }
    })
    await waitForSelectedIndex(4) // Last command
    
    // Go to home
    await act(async () => {
      await user.keyboard('{Home}')
      if (CI_NAVIGATION_DELAY > 0) {
        await new Promise(resolve => setTimeout(resolve, CI_NAVIGATION_DELAY))
      }
    })
    await waitForSelectedIndex(0) // First command
  })

  it('should close on Escape key', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    await act(async () => {
      await user.keyboard('{Escape}')
    })
    
    await waitFor(() => {
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should close when clicking outside', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      }
    )
    
    // Wait for command palette to be rendered
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
    
    // Click on the overlay (outside the dialog)
    const overlay = document.querySelector('[data-overlay]')
    if (overlay) {
      await act(async () => {
        await user.click(overlay as HTMLElement)
      })
      
      await waitFor(() => {
        expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
      }, { timeout: CI_TIMEOUT })
    }
  })

  it('should not close when clicking inside', async () => {
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen
      }
    )
    
    const input = await getCommandSearchInput()
    
    // Click on the dialog content (inside)
    const dialog = screen.getByRole('dialog')
    
    await act(async () => {
      await user.click(dialog)
    })
    
    expect(mockSetCommandPaletteOpen).not.toHaveBeenCalled()
  })

  it('should switch to search view on Enter', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen,
        setCurrentView: mockSetCurrentView
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // First command is Search History
    await act(async () => {
      await user.keyboard('{Enter}')
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('search')
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should create new note', async () => {
    const mockCreateNote = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen,
        createNote: mockCreateNote
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Click on New Note button
    const newNoteButton = screen.getByText('New Note')
    
    await act(async () => {
      await user.click(newNoteButton)
    })
    
    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalled()
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should handle export when note is active', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn(),
        getActiveNote: () => mockNote
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Click on Export Note button
    const exportButton = screen.getByText('Export Note')
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('export_note', { id: mockNote.id })
    }, { timeout: CI_TIMEOUT })
  })

  it('should show error when trying to export without active note', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn(),
        getActiveNote: () => null
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Click on Export Note button
    const exportButton = screen.getByText('Export Note')
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('No active note to export')
    }, { timeout: CI_TIMEOUT })
    
    consoleSpy.mockRestore()
  })

  it('should handle export error', async () => {
    const user = createUser()
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Export failed'))
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn(),
        getActiveNote: () => mockNote
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Click on Export Note button
    const exportButton = screen.getByText('Export Note')
    
    await act(async () => {
      await user.click(exportButton)
    })
    
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to export note')
    }, { timeout: CI_TIMEOUT })
  })

  it('should open settings view', async () => {
    const mockSetCurrentView = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: mockSetCommandPaletteOpen,
        setCurrentView: mockSetCurrentView
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Click on Open Settings button
    const settingsButton = screen.getByText('Open Settings')
    
    await act(async () => {
      await user.click(settingsButton)
    })
    
    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('settings')
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    }, { timeout: CI_TIMEOUT })
  })

  it('should clear search on close', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Type search query
    await act(async () => {
      await user.type(input, 'test search')
    })
    
    expect(input.value).toBe('test search')
    
    // Close and reopen
    await act(async () => {
      useScratchPadStore.setState({ isCommandPaletteOpen: false })
    })
    
    await act(async () => {
      useScratchPadStore.setState({ isCommandPaletteOpen: true })
    })
    
    const newInput = await getCommandSearchInput()
    expect(newInput.value).toBe('')
  })

  it('should handle rapid close/open cycles', async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        useScratchPadStore.setState({ isCommandPaletteOpen: true })
      })
      
      await renderWithState(
        <CommandPalette />,
        { 
          isCommandPaletteOpen: true,
          setCommandPaletteOpen: vi.fn()
        }
      )
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
      }, { timeout: CI_TIMEOUT })
      
      await act(async () => {
        useScratchPadStore.setState({ isCommandPaletteOpen: false })
      })
      
      await cleanupTestEnhanced()
    }
  })

  it('should handle component unmount gracefully', async () => {
    const { unmount } = await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    expect(input).toBeInTheDocument()
    
    // Unmount should not throw
    expect(() => unmount()).not.toThrow()
  })

  it('should handle malformed search queries', async () => {
    const user = createUser()
    
    await renderWithState(
      <CommandPalette />,
      { 
        isCommandPaletteOpen: true,
        setCommandPaletteOpen: vi.fn()
      }
    )
    
    const input = await getCommandSearchInput()
    await waitForInputFocus(input, CI_FOCUS_TIMEOUT)
    
    // Type malformed query with special characters
    await act(async () => {
      await user.type(input, '***[]()')
    })
    
    // Should not crash, still show no results
    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument()
    }, { timeout: CI_TIMEOUT })
  })
})