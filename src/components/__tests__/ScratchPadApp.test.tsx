import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ScratchPadApp } from '../ScratchPadApp'
import { useScratchPadStore } from '../../lib/store'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core')
const mockInvoke = vi.mocked(invoke)

// Mock performance monitoring hooks
vi.mock('../../hooks/usePerformanceMonitor', () => ({
  useRenderPerformance: vi.fn(),
  useMemoryMonitor: vi.fn(),
  useStartupPerformance: vi.fn()
}))

// Mock memory cleanup hooks
vi.mock('../../hooks/useMemoryCleanup', () => ({
  useMemoryCleanup: vi.fn(),
  useDataCleanup: vi.fn()
}))

// Mock error boundary components
vi.mock('../error-boundary', () => ({
  ApplicationErrorBoundary: ({ children }: any) => children,
  ViewErrorBoundary: ({ children }: any) => children,
  ComponentErrorBoundary: ({ children }: any) => children,
  AsyncErrorHandler: () => null,
  TauriErrorBoundary: ({ children }: any) => children,
  safeInvoke: vi.fn().mockImplementation((command: string, payload?: any) => 
    mockInvoke(command, payload)
  )
}))

// Mock toast hook
vi.mock('../ui/toast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    ToastContainer: () => <div data-testid="toast-container" />
  })
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

// Mock loading components
vi.mock('../ui/loading', () => ({
  FullPageLoading: ({ message }: any) => <div data-testid="loading">{message}</div>,
  Skeleton: ({ width, height }: any) => <div data-testid="skeleton" style={{ width, height }} />
}))

describe('ScratchPadApp', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset store state
    useScratchPadStore.setState({
      currentView: 'note',
      error: null,
      isCommandPaletteOpen: false,
      notes: [],
      loadNotes: vi.fn().mockResolvedValue(undefined),
      initializeSettings: vi.fn().mockResolvedValue(undefined)
    })
    
    mockInvoke.mockClear()
    mockInvoke.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render note view by default', async () => {
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('note-view')).toBeInTheDocument()
    }, { timeout: 10000 })
    
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should render search history view when currentView is search-history', async () => {
    useScratchPadStore.setState({ currentView: 'search-history' })
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('search-history-view')).toBeInTheDocument()
    }, { timeout: 10000 })
    
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should render settings view when currentView is settings', async () => {
    useScratchPadStore.setState({ currentView: 'settings' })
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    }, { timeout: 10000 })
    
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
  })

  it('should display error message when error exists', async () => {
    useScratchPadStore.setState({ error: 'Test error message' })
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    }, { timeout: 10000 })
    
    // Should not render other views when error exists
    expect(screen.queryByTestId('note-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-history-view')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-view')).not.toBeInTheDocument()
  })

  it('should initialize app on mount', async () => {
    const mockLoadNotes = vi.fn().mockResolvedValue(undefined)
    const mockInitializeSettings = vi.fn().mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      loadNotes: mockLoadNotes,
      initializeSettings: mockInitializeSettings
    })
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      expect(mockInitializeSettings).toHaveBeenCalledOnce()
      expect(mockLoadNotes).toHaveBeenCalledOnce()
    }, { timeout: 15000 })
  })

  it('should handle Escape key to hide window when no modals are open', async () => {
    const { safeInvoke } = await import('../error-boundary')
    const mockSafeInvoke = vi.mocked(safeInvoke)
    mockSafeInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'note'
    })
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(mockSafeInvoke).toHaveBeenCalledWith('hide_window')
    }, { timeout: 10000 })
  })

  it('should not hide window on Escape when command palette is open', async () => {
    const { safeInvoke } = await import('../error-boundary')
    const mockSafeInvoke = vi.mocked(safeInvoke)
    mockSafeInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: true,
      currentView: 'note'
    })
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when command palette is open
    expect(mockSafeInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should not hide window on Escape when in search-history view', async () => {
    const { safeInvoke } = await import('../error-boundary')
    const mockSafeInvoke = vi.mocked(safeInvoke)
    mockSafeInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'search-history'
    })
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when in search-history view
    expect(mockSafeInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should not hide window on Escape when in settings view', async () => {
    const { safeInvoke } = await import('../error-boundary')
    const mockSafeInvoke = vi.mocked(safeInvoke)
    mockSafeInvoke.mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'settings'
    })
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    // Should not call hide_window when in settings view
    expect(mockSafeInvoke).not.toHaveBeenCalledWith('hide_window')
  })

  it('should handle hide window error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { safeInvoke } = await import('../error-boundary')
    const mockSafeInvoke = vi.mocked(safeInvoke)
    mockSafeInvoke.mockRejectedValue(new Error('Hide window failed'))
    
    useScratchPadStore.setState({
      isCommandPaletteOpen: false,
      currentView: 'note'
    })
    render(<ScratchPadApp />)
    
    await user.keyboard('{Escape}')
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to hide window:', expect.any(Error))
    }, { timeout: 10000 })
    
    consoleSpy.mockRestore()
  })

  it('should apply correct styling', async () => {
    render(<ScratchPadApp />)
    
    await waitFor(() => {
      const appContainer = screen.getByTestId('note-view').parentElement?.parentElement
      expect(appContainer).toHaveClass('h-screen', 'w-screen', 'overflow-hidden')
    }, { timeout: 10000 })
  })

  it('should render command palette in all views', async () => {
    const views = ['note', 'search-history', 'settings'] as const
    
    for (const view of views) {
      useScratchPadStore.setState({ currentView: view, error: null })
      
      const { unmount } = render(<ScratchPadApp />)
      
      await waitFor(() => {
        expect(screen.getByTestId('command-palette')).toBeInTheDocument()
      }, { timeout: 10000 })
      
      unmount()
    }
  })

  it('should handle initialization errors gracefully', async () => {
    // Mock console.error to suppress error output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const mockLoadNotes = vi.fn().mockRejectedValue(new Error('Load failed'))
    const mockInitializeSettings = vi.fn().mockRejectedValue(new Error('Init failed'))
    
    useScratchPadStore.setState({
      loadNotes: mockLoadNotes,
      initializeSettings: mockInitializeSettings
    })
    
    // Render the component
    const { container } = render(<ScratchPadApp />)
    
    // Wait for initializeSettings to be called (it's called immediately)
    await waitFor(() => {
      expect(mockInitializeSettings).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Component should still be rendered despite initialization error
    expect(container.firstChild).toBeTruthy()
    
    // Clean up
    consoleErrorSpy.mockRestore()
  })
})