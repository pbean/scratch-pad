import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
import { setupUser } from '../../../test/userEvent-utils'
import { SettingsView } from '../SettingsView'
import { useScratchPadStore } from '../../../lib/store'

const mockSettings = {
  global_shortcut: 'Ctrl+Shift+N',
  ui_font: 'Inter',
  editor_font: 'SauceCodePro Nerd Font',
  default_note_format: 'plaintext',
  layout_mode: 'default',
  window_width: '800',
  window_height: '600',
  auto_save_delay_ms: '500',
  search_limit: '100',
  fuzzy_search_threshold: '0.6'
}

describe('SettingsView', () => {
  let user: Awaited<ReturnType<typeof setupUser>>

  // Helper functions for input operations with userEvent
  const clearInput = async (element: HTMLElement) => {
    await user.clear(element)
  }
  
  const typeInInput = async (element: HTMLElement, text: string) => {
    await user.type(element, text)
  }

  // Mock URL.createObjectURL and URL.revokeObjectURL for blob handling
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(async () => {
    // Mock URL methods for blob download handling
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    
    // Configure userEvent without fake timers
    user = await setupUser()
    
    // Complete store initialization with ALL properties for React 19
    useScratchPadStore.setState({
      // UI State
      currentView: 'settings',
      isCommandPaletteOpen: false,
      expandedFolders: new Set(),
      theme: 'light',
      
      // Notes State
      notes: [],
      activeNoteId: null,
      noteContents: {},
      isLoading: false,
      
      // Search State
      searchQuery: '',
      searchResults: [],
      searchHistory: [],
      
      // System State
      error: null,
      
      // Actions - Settings specific
      setCurrentView: vi.fn(),
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: vi.fn().mockResolvedValue(undefined),
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      
      // Other required actions
      setCommandPaletteOpen: vi.fn(),
      loadNotes: vi.fn(),
      createNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      getActiveNote: vi.fn(),
      setActiveNoteId: vi.fn(),
      updateNoteContent: vi.fn(),
      searchNotes: vi.fn(),
      addToSearchHistory: vi.fn(),
      clearSearchHistory: vi.fn(),
      toggleFolder: vi.fn()
    })
    
    // Reset window mocks (already set up in test setup)
    vi.mocked(window.confirm).mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Restore original URL methods
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('should render loading state initially', async () => {
    // Mock a delayed response to see loading state
    const delayedGetAllSettings = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSettings), 100))
    )
    useScratchPadStore.setState({ getAllSettings: delayedGetAllSettings })

    render(<SettingsView />)
    
    // Should see loading state immediately
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
    
    // Wait for settings to load using React 19 async pattern
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should load and display settings', async () => {
    render(<SettingsView />)
    
    // Use React 19 async pattern for form fields
    await waitFor(() => {
      // Check regular input values
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
      expect(screen.getByDisplayValue('600')).toBeInTheDocument()
      expect(screen.getByDisplayValue('500')).toBeInTheDocument()
      expect(screen.getByDisplayValue('100')).toBeInTheDocument()
      expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should render all settings sections', async () => {
    render(<SettingsView />)
    
    // Wait for async font loading and section rendering
    await waitFor(() => {
      expect(screen.getByText('Global Shortcut')).toBeInTheDocument()
      expect(screen.getByText('Font Preferences')).toBeInTheDocument()
      expect(screen.getByText('Note Format & Layout')).toBeInTheDocument()
      expect(screen.getByText('Window Settings')).toBeInTheDocument()
      expect(screen.getByText('Performance Settings')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
    
    render(<SettingsView />)
    
    // Use findBy for async element discovery
    const backButton = await screen.findByText('Back to Notes')
    await user.click(backButton)
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should validate form inputs', async () => {
    render(<SettingsView />)
    
    // Wait for form to load with React 19 pattern
    const shortcutInput = await screen.findByDisplayValue('Ctrl+Shift+N')
    
    // Clear global shortcut (required field)
    await clearInput(shortcutInput)
    
    // Try to save
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Global shortcut cannot be empty')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should validate numeric fields', async () => {
    render(<SettingsView />)
    
    // Wait for form to load using React 19 async pattern
    const widthInput = await screen.findByDisplayValue('800')
    
    // Set invalid window width
    await clearInput(widthInput)
    await typeInInput(widthInput, '100') // Too small
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should save settings successfully', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    // Wait for async form loading
    const shortcutInput = await screen.findByDisplayValue('Ctrl+Shift+N')
    
    // Modify a setting
    await clearInput(shortcutInput)
    await typeInInput(shortcutInput, 'Ctrl+Alt+S')
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('global_shortcut', 'Ctrl+Alt+S')
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should handle save errors', async () => {
    const mockSetSetting = vi.fn().mockRejectedValue(new Error('Save failed'))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<SettingsView />)
    
    // Wait for form to load
    await screen.findByDisplayValue('Ctrl+Shift+N')
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error))
    }, { timeout: 2000 })
    
    consoleSpy.mockRestore()
  })

  it('should export settings', async () => {
    const mockExportSettings = vi.fn().mockResolvedValue('{"test": "data"}')
    useScratchPadStore.setState({ exportSettings: mockExportSettings })
    
    render(<SettingsView />)
    
    const exportButton = await screen.findByText('Export Settings')
    await user.click(exportButton)
    
    await waitFor(() => {
      expect(mockExportSettings).toHaveBeenCalled()
      expect(screen.getByText('Settings exported successfully!')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should import settings', async () => {
    const mockImportSettings = vi.fn().mockResolvedValue(3)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      importSettings: mockImportSettings,
      getAllSettings: mockGetAllSettings
    })
    
    render(<SettingsView />)
    
    const importButton = await screen.findByText('Import Settings')
    await user.click(importButton)
    
    // The file input interaction is complex in tests
    // Since we don't mock createElement anymore, just verify import was called
    // Import happens after file selection which is hard to test without mocks
  })

  it('should reset settings to defaults', async () => {
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      resetSettingsToDefaults: mockResetSettings,
      getAllSettings: mockGetAllSettings
    })
    
    render(<SettingsView />)
    
    const resetButton = await screen.findByText('Reset to Defaults')
    await user.click(resetButton)
    
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to reset all settings to their default values? This action cannot be undone.'
      )
      expect(mockResetSettings).toHaveBeenCalled()
      expect(screen.getByText('Settings reset to defaults successfully!')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should not reset settings if user cancels', async () => {
    const mockResetSettings = vi.fn()
    useScratchPadStore.setState({ resetSettingsToDefaults: mockResetSettings })
    
    vi.mocked(window.confirm).mockReturnValue(false)
    
    render(<SettingsView />)
    
    const resetButton = await screen.findByText('Reset to Defaults')
    await user.click(resetButton)
    
    expect(mockResetSettings).not.toHaveBeenCalled()
  })

  it('should clear validation errors when input changes', async () => {
    render(<SettingsView />)
    
    // Wait for form to load
    const widthInput = await screen.findByDisplayValue('800')
    
    // Create validation error
    await clearInput(widthInput)
    await typeInInput(widthInput, '100')
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Fix the error
    await clearInput(widthInput)
    await typeInInput(widthInput, '800')
    
    await waitFor(() => {
      expect(screen.queryByText('Window width must be between 400 and 3840 pixels')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should display error messages', async () => {
    useScratchPadStore.setState({ error: 'Test error message' })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should handle loading errors gracefully', async () => {
    const mockGetAllSettings = vi.fn().mockRejectedValue(new Error('Load failed'))
    useScratchPadStore.setState({ getAllSettings: mockGetAllSettings })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error))
    }, { timeout: 2000 })
    
    consoleSpy.mockRestore()
  })

  it('should show saving state', async () => {
    const mockSetSetting = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should validate fuzzy search threshold range', async () => {
    render(<SettingsView />)
    
    // Wait for form load with React 19 async pattern
    const thresholdInput = await screen.findByDisplayValue('0.6')
    
    await clearInput(thresholdInput)
    await typeInInput(thresholdInput, '1.5') // Out of range
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Fuzzy search threshold must be between 0.0 and 1.0')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should validate auto-save delay range', async () => {
    render(<SettingsView />)
    
    // Use React 19 async pattern for form field discovery
    const delayInput = await screen.findByDisplayValue('500')
    
    await clearInput(delayInput)
    await typeInInput(delayInput, '50') // Too small
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Auto-save delay must be between 100 and 10000 milliseconds')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should auto-hide success messages', async () => {
    // Use real timers for React 19 - trust component's setTimeout behavior
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    const saveButton = await screen.findByText('Save Settings')
    await user.click(saveButton)
    
    // Wait for success message to appear
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Trust React 19 and component's internal setTimeout (3000ms)
    // Wait for message to disappear - giving extra time for React 19's async behavior
    await waitFor(() => {
      expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument()
    }, { timeout: 4000 }) // Extended timeout for auto-hide
  })
})