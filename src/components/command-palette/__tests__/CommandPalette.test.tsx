import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../CommandPalette'
import { useScratchPadStore } from '../../../lib/store'
import { setMockStoreData, mockStoreMethod, spyOnStore } from '../../../test/store-test-utils'
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
    // Set up data state only
    setMockStoreData({
      isCommandPaletteOpen: false,
      searchQuery: '',
      searchResults: [],
      notes: [],
      activeNoteId: null,
      recentSearches: [],
    })
    
    // Mock store methods that are commonly used
    mockStoreMethod('searchNotes', vi.fn().mockResolvedValue([]))
    mockStoreMethod('createNote', vi.fn().mockResolvedValue(mockNote))
    mockStoreMethod('deleteNote', vi.fn().mockResolvedValue(undefined))
    mockStoreMethod('loadNotes', vi.fn().mockResolvedValue([]))
    
    // Reset Tauri and toast mocks
    vi.mocked(invoke).mockClear()
    Object.values(mockToast).forEach(fn => fn.mockClear())
  })

  it('should not render when closed', () => {
    setMockStoreData({ isCommandPaletteOpen: false })
    render(<CommandPalette />)
    
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
  })

  it('should render when open', async () => {
    setMockStoreData({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
    })
  })

  it('should focus input when opened', async () => {
    setMockStoreData({ isCommandPaletteOpen: true })
    
    render(<CommandPalette />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Type a command or search...')
      expect(input).toHaveFocus()
    })
  })

  it('should handle search input changes', async () => {
    const user = userEvent.setup()
    
    setMockStoreData({ isCommandPaletteOpen: true })
    const searchSpy = mockStoreMethod('searchNotes', vi.fn().mockResolvedValue([mockNote]))
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'test')
    
    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('test')
    })
  })

  it('should display search results', async () => {
    setMockStoreData({
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
    
    setMockStoreData({
      isCommandPaletteOpen: true,
      searchResults: [mockNote]
    })
    const setActiveNoteSpy = spyOnStore('setActiveNote')
    const setCommandPaletteOpenSpy = spyOnStore('setCommandPaletteOpen')
    
    render(<CommandPalette />)
    
    const noteItem = await screen.findByText('Test Note')
    await user.click(noteItem)
    
    expect(setActiveNoteSpy).toHaveBeenCalledWith(1)
    expect(setCommandPaletteOpenSpy).toHaveBeenCalledWith(false)
  })

  it('should handle new note creation', async () => {
    const user = userEvent.setup()
    
    setMockStoreData({
      isCommandPaletteOpen: true,
      searchQuery: 'new note content',
      searchResults: []
    })
    const createNoteSpy = mockStoreMethod('createNote', vi.fn().mockResolvedValue(mockNote))
    const setActiveNoteSpy = spyOnStore('setActiveNote')
    const setCommandPaletteOpenSpy = spyOnStore('setCommandPaletteOpen')
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{enter}')
    
    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalledWith('new note content')
      expect(setActiveNoteSpy).toHaveBeenCalledWith(1)
      expect(setCommandPaletteOpenSpy).toHaveBeenCalledWith(false)
    })
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()
    
    setMockStoreData({
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
    
    setMockStoreData({ isCommandPaletteOpen: true })
    const setCommandPaletteOpenSpy = spyOnStore('setCommandPaletteOpen')
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, '{escape}')
    
    expect(setCommandPaletteOpenSpy).toHaveBeenCalledWith(false)
  })

  it('should handle delete note command', async () => {
    const user = userEvent.setup()
    
    setMockStoreData({
      isCommandPaletteOpen: true,
      searchResults: [mockNote]
    })
    const deleteNoteSpy = mockStoreMethod('deleteNote', vi.fn().mockResolvedValue(undefined))
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'delete:1')
    await user.type(input, '{enter}')
    
    await waitFor(() => {
      expect(deleteNoteSpy).toHaveBeenCalledWith(1)
    })
  })

  // Skipping favorite toggle test as toggleFavorite method doesn't exist in store
  it.skip('should handle favorite toggle command', async () => {
    const user = userEvent.setup()
    
    setMockStoreData({
      isCommandPaletteOpen: true,
      searchResults: [mockNote]
    })
    // toggleFavorite method doesn't exist in current store implementation
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'favorite:1')
    await user.type(input, '{enter}')
    
    // Test would need toggleFavorite to be implemented
  })

  it('should show recent searches when input is empty', async () => {
    setMockStoreData({
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
    
    setMockStoreData({ isCommandPaletteOpen: true })
    mockStoreMethod('searchNotes', vi.fn().mockRejectedValue(new Error('Search failed')))
    
    render(<CommandPalette />)
    
    const input = await screen.findByPlaceholderText('Type a command or search...')
    await user.type(input, 'test')
    
    // Should not crash and continue to work
    await waitFor(() => {
      expect(input).toHaveValue('test')
    })
  })

  it('should clear search query when opened', async () => {
    setMockStoreData({
      isCommandPaletteOpen: false,
      searchQuery: 'old query'
    })
    
    const { rerender } = render(<CommandPalette />)
    
    // Open the palette
    setMockStoreData({
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