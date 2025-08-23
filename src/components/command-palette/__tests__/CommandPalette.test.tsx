import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import type { Note } from '../../../types'
import { invoke } from '@tauri-apps/api/core'

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
    // Set up mocks BEFORE render using setState
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      searchQuery: '',
      searchResults: [],
      notes: [],
      activeNoteId: null,
      recentSearches: [],
      setCommandPaletteOpen: vi.fn(),
      searchNotes: vi.fn().mockResolvedValue([]),
      createNote: vi.fn().mockResolvedValue(mockNote),
      setActiveNote: vi.fn(),
      loadNotes: vi.fn().mockResolvedValue([]),
      deleteNote: vi.fn().mockResolvedValue(undefined),
      toggleFavorite: vi.fn().mockResolvedValue(undefined),
      setCurrentView: vi.fn(),
      clearError: vi.fn(),
    })
    
    // Reset Tauri and toast mocks
    vi.mocked(invoke).mockClear()
    Object.values(mockToast).forEach(fn => fn.mockClear())
  })

  it('should not render when closed', () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: false })
    render(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    })
  })

  it('should focus input when opened', async () => {
    useScratchPadStore.setState({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Type a command or search...')
      expect(input).toHaveFocus()
    })
  })

  it('should handle search input changes', async () => {
    const user = userEvent.setup()
    const mockSearchNotes = vi.fn().mockResolvedValue([mockNote])
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchNotes: mockSearchNotes
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'test')
    
    await waitFor(() => {
      expect(mockSearchNotes).toHaveBeenCalledWith('test')
    })
  })

  it('should display search results', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchResults: [mockNote]
    })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument()
    })
  })

  it('should handle note selection', async () => {
    const user = userEvent.setup()
    const mockSetActiveNote = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchResults: [mockNote],
      setActiveNote: mockSetActiveNote,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    const noteItem = await screen.findByText('Test Note')
    await user.click(noteItem)
    
    expect(mockSetActiveNote).toHaveBeenCalledWith(1)
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should handle new note creation', async () => {
    const user = userEvent.setup()
    const mockCreateNote = vi.fn().mockResolvedValue(mockNote)
    const mockSetActiveNote = vi.fn()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchQuery: 'new note content',
      searchResults: [],
      createNote: mockCreateNote,
      setActiveNote: mockSetActiveNote,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{enter}')
    
    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledWith('new note content')
      expect(mockSetActiveNote).toHaveBeenCalledWith(1)
      expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
    })
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchResults: [mockNote, { ...mockNote, id: 2, nickname: 'Second Note' }]
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{arrowdown}')
    
    // Should highlight first item
    await waitFor(() => {
      const firstItem = screen.getByText('Test Note')
      expect(firstItem).toHaveClass('bg-accent')
    })
    
    await user.type(input, '{arrowdown}')
    
    // Should move to second item
    await waitFor(() => {
      const secondItem = screen.getByText('Second Note')
      expect(secondItem).toHaveClass('bg-accent')
    })
  })

  it('should close on Escape key', async () => {
    const user = userEvent.setup()
    const mockSetCommandPaletteOpen = vi.fn()
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      setCommandPaletteOpen: mockSetCommandPaletteOpen
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{escape}')
    
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false)
  })

  it('should handle delete note command', async () => {
    const user = userEvent.setup()
    const mockDeleteNote = vi.fn().mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchResults: [mockNote],
      deleteNote: mockDeleteNote
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'delete:1')
    await user.type(input, '{enter}')
    
    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith(1)
    })
  })

  it('should handle favorite toggle command', async () => {
    const user = userEvent.setup()
    const mockToggleFavorite = vi.fn().mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchResults: [mockNote],
      toggleFavorite: mockToggleFavorite
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'favorite:1')
    await user.type(input, '{enter}')
    
    await waitFor(() => {
      expect(mockToggleFavorite).toHaveBeenCalledWith(1)
    })
  })

  it('should show recent searches when input is empty', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchQuery: '',
      recentSearches: ['recent search'],
      searchResults: []
    })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument()
      expect(screen.getByText('recent search')).toBeInTheDocument()
    })
  })

  it('should handle error states gracefully', async () => {
    const user = userEvent.setup()
    const mockSearchNotes = vi.fn().mockRejectedValue(new Error('Search failed'))
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchNotes: mockSearchNotes
    })
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'test')
    
    // Should not crash and continue to work
    await waitFor(() => {
      expect(input).toHaveValue('test')
    })
  })

  it('should clear search query when opened', async () => {
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      searchQuery: 'old query'
    })
    
    const { rerender } = render(<CommandPalette />)
    
    // Open the palette
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      searchQuery: ''
    })
    
    rerender(<CommandPalette />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Type a command or search...')
      expect(input).toHaveValue('')
    })
  })
})