import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScratchPadApp } from '../ScratchPadApp'
import { useScratchPadStore } from '../../lib/store'

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

// Mock child components
vi.mock('../note-view/NoteView', () => ({
  NoteView: () => <div data-testid="note-view">Note View</div>
}))

vi.mock('../search-history/SearchHistoryView', () => ({
  SearchHistoryView: () => <div data-testid="search-history-view">Search History View</div>
}))

vi.mock('../settings/SettingsView', () => ({
  SettingsView: () => <div data-testid="settings-view">Settings View</div>
}))

vi.mock('../command-palette/CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette">Command Palette</div>
}))

describe('ScratchPadApp', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset store state
    useScratchPadStore.setState({
      currentView: 'note',
      error: null,
      isCommandPaletteOpen: false,
      loadNotes: vi.fn(),
      initializeSettings: vi.fn()
    })
    
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render note view by default', async () => {
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('note-view')).toBeInTheDocument()
    })
    
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should render search history view when currentView is search-history', async () => {
    useScratchPadStore.setState({ currentView: 'search-history' })
    
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('search-history-view')).toBeInTheDocument()
    })
    
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should render settings view when currentView is settings', async () => {
    useScratchPadStore.setState({ currentView: 'settings' })
    
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    })
    
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
  })

  it('should display error message when error exists', async () => {
    useScratchPadStore.setState({ error: 'Test error message' })
    
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
    
    // Should not render other views when error exists
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should initialize app on mount', async () => {
    const mockLoadNotes = vi.fn()
    const mockInitializeSettings = vi.fn()
    
    useScratchPadStore.setState({
      loadNotes: mockLoadNotes,
      initializeSettings: mockInitializeSettings
    })
    
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(mockInitializeSettings).toHaveBeenCalledOnce()
      expect(mockLoadNotes).toHaveBeenCalledOnce()
    })
  })

  it('should handle Escape key to hide window when no modals are open', async () => {
    mockInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'note'
    })
    
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('hide_window')
    })
  })

  it('should not hide window on Escape when command palette is open', async () => {
    mockInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      currentView: 'note'
    })
    
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when command palette is open
    expect(mockInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should not hide window on Escape when in search-history view', async () => {
    mockInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'search-history'
    })
    
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when in search-history view
    expect(mockInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should not hide window on Escape when in settings view', async () => {
    mockInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'settings'
    })
    
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when in settings view
    expect(mockInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should handle hide window error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInvoke.mockRejectedValue(new Error('Hide window failed'))
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'note'
    })
    
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to hide window:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should apply correct styling', async () => {
    render(<ScratchPadApp />)
    
    const appContainer = screen.getByTestId('note-view').parentElement
    
    expect(appContainer).toHaveClass('h-screen', 'w-screen', 'overflow-hidden')
  })

  it('should render command palette in all views', async () => {
    const views = ['note', 'search-history', 'settings'] as const
    
    for (const view of views) {
      useScratchPadStore.setState({ currentView: view, error: null })
      
      const { unmount } = render(<ScratchPadApp />)
      
      await waitFor(() => {
        expect(screen.getByTestId('command-palette')).toBeInTheDocument()
      })
      
      unmount()
    }
  })

  it('should handle initialization errors gracefully', async () => {
    const mockLoadNotes = vi.fn().mockRejectedValue(new Error('Load failed'))
    const mockInitializeSettings = vi.fn().mockRejectedValue(new Error('Init failed'))
    
    useScratchPadStore.setState({
      loadNotes: mockLoadNotes,
      initializeSettings: mockInitializeSettings
    })
    
    // Should not throw error
    expect(() => render(<ScratchPadApp />)).not.toThrow()
    
    await waitFor(() => {
      expect(mockInitializeSettings).toHaveBeenCalled()
      expect(mockLoadNotes).toHaveBeenCalled()
    })
  })
})