import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import { addMockNote, resetMockDatabase } from '../../../test/mocks/handlers'
import type { Note } from '../../../types'

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
  beforeEach(() => {
    // Reset the mock database and store state
    resetMockDatabase()
    
    // Ensure clean state - explicitly set closed first
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      searchQuery: '',
      searchResults: [],
      notes: [],
      activeNoteId: null,
      recentSearches: [],
    })
    
    // Reset toast mocks
    Object.values(mockToast).forEach(fn => fn.mockClear())
    
    // Clear any existing rendered elements
    document.body.innerHTML = ''
  })

  it('should not render when closed', () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: false })
    render(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for the component to render and check there's only one
    await waitFor(() => {
      const inputs = screen.queryAllByPlaceholderText('Type a command or search...')
      expect(inputs).toHaveLength(1)
    })
    
    const input = screen.getByPlaceholderText('Type a command or search...')
    expect(input).toBeInTheDocument()
  })

  it('should focus input when opened', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Use findBy and wait for focus
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await waitFor(() => {
      expect(input).toHaveFocus()
    })
  })

  it('should display all commands initially', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    // Wait for the component to render first
    await screen.findByPlaceholderText('Type a command or search...')
    
    // Then check for all commands
    expect(await screen.findByText('New Note')).toBeInTheDocument()
    expect(await screen.findByText('Open Settings')).toBeInTheDocument()
    expect(await screen.findByText('Export Note')).toBeInTheDocument()
    expect(await screen.findByText('Search History')).toBeInTheDocument()
    expect(await screen.findByText('Open Folder')).toBeInTheDocument()
  })

  it('should filter commands based on input', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'settings')
    
    await waitFor(async () => {
      // Only Settings command should be visible
      expect(await screen.findByText('Open Settings')).toBeInTheDocument()
      expect(screen.queryByText('New Note')).not.toBeInTheDocument()
      expect(screen.queryByText('Export Note')).not.toBeInTheDocument()
    })
  })

  it('should execute New Note command', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    render(<CommandPalette />)
    
    // Wait for palette to render then find command
    await screen.findByPlaceholderText('Type a command or search...')
    const newNoteCmd = await screen.findByText('New Note')
    await user.click(newNoteCmd)
    
    // Check that a new note was created via MSW
    await waitFor(() => {
      const state = useScratchPadStore.getState()
      expect(state.notes).toHaveLength(1)
      expect(state.activeNoteId).toBeTruthy()
    })
  })

  it('should execute Open Settings command', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    render(<CommandPalette />)
    
    // Wait for palette to render then find command
    await screen.findByPlaceholderText('Type a command or search...')
    const settingsCmd = await screen.findByText('Open Settings')
    await user.click(settingsCmd)
    
    // Check that the view changed to settings
    await waitFor(() => {
      const state = useScratchPadStore.getState()
      expect(state.currentView).toBe('settings')
    })
  })

  it('should handle keyboard navigation between commands', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    
    // Navigate down to first command
    await user.type(input, '{arrowdown}')
    
    // First command should be highlighted
    await waitFor(async () => {
      const firstCommand = (await screen.findByText('Search History')).closest('[role="option"]')
      expect(firstCommand).toHaveAttribute('aria-selected', 'true')
    })
    
    // Navigate down to second command
    await user.type(input, '{arrowdown}')
    
    await waitFor(async () => {
      const secondCommand = (await screen.findByText('New Note')).closest('[role="option"]')
      expect(secondCommand).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('should close on Escape key', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{escape}')
    
    await waitFor(() => {
      const state = useScratchPadStore.getState()
      expect(state.isCommandPaletteOpen).toBe(false)
    })
  })

  it('should execute Search History command', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    render(<CommandPalette />)
    
    // Wait for palette then find command
    await screen.findByPlaceholderText('Type a command or search...')
    const searchCmd = await screen.findByText('Search History')
    await user.click(searchCmd)
    
    await waitFor(() => {
      const state = useScratchPadStore.getState()
      expect(state.currentView).toBe('search-history')
    })
  })

  it('should show Export Note command', async () => {
    // Add an active note so export is available
    const note = addMockNote('Test content')
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      notes: [note],
      activeNoteId: note.id
    })
    
    render(<CommandPalette />)
    
    // Wait for palette to render then check command
    await screen.findByPlaceholderText('Type a command or search...')
    expect(await screen.findByText('Export Note')).toBeInTheDocument()
  })

  it('should show command shortcuts', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    render(<CommandPalette />)
    
    // Wait for palette to render then check shortcuts
    await screen.findByPlaceholderText('Type a command or search...')
    
    // Check that shortcuts are displayed
    expect(await screen.findByText('Ctrl+Shift+F')).toBeInTheDocument() // Search History
    expect(await screen.findByText('Ctrl+N')).toBeInTheDocument() // New Note
  })

  it('should handle Enter key on selected command', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    
    // Navigate to first command and execute
    await user.type(input, '{arrowdown}')
    await user.type(input, '{enter}')
    
    // Should execute Search History command
    await waitFor(() => {
      const state = useScratchPadStore.getState()
      expect(state.currentView).toBe('search-history')
    })
  })

  it('should reset input when opened', async () => {
    const { rerender } = render(<CommandPalette />)
    
    // First render with palette closed
    useScratchPadStore.setState({
      isCommandPaletteOpen: false
    })
    
    rerender(<CommandPalette />)
    
    // Now open the palette
    useScratchPadStore.setState({
      isCommandPaletteOpen: true
    })
    
    rerender(<CommandPalette />)
    
    // Use findBy for async element
    const input = await screen.findByPlaceholderText('Type a command or search...')
    expect(input).toHaveValue('')
  })
})