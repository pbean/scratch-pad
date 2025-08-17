import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from '../SettingsView'
import { useScratchPadStore } from '../../../lib/store'

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn()
})

// Mock URL.createObjectURL and related APIs
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn()
  }
})

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
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset store state
    useScratchPadStore.setState({
      setCurrentView: vi.fn(),
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: vi.fn().mockResolvedValue(undefined),
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(undefined),
      error: null,
      setError: vi.fn()
    })
    
    // Reset window mocks
    vi.mocked(window.confirm).mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<SettingsView />)
    
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
  })

  it('should load and display settings', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
  })

  it('should render all settings sections', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Global Shortcut')).toBeInTheDocument()
      expect(screen.getByText('Font Preferences')).toBeInTheDocument()
      expect(screen.getByText('Note Format & Layout')).toBeInTheDocument()
      expect(screen.getByText('Window Settings')).toBeInTheDocument()
      expect(screen.getByText('Performance Settings')).toBeInTheDocument()
    })
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    useScratchPadStore.setState({ setCurrentView: mockSetCurrentView })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Back to Notes')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Back to Notes'))
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should validate form inputs', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Clear global shortcut (required field)
    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    await user.clear(shortcutInput)
    
    // Try to save
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Global shortcut cannot be empty')).toBeInTheDocument()
  })

  it('should validate numeric fields', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Set invalid window width
    const widthInput = screen.getByDisplayValue('800')
    await user.clear(widthInput)
    await user.type(widthInput, '100') // Too small
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
  })

  it('should save settings successfully', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
    
    // Modify a setting
    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    await user.clear(shortcutInput)
    await user.type(shortcutInput, 'Ctrl+Alt+S')
    
    await user.click(screen.getByText('Save Settings'))
    
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('global_shortcut', 'Ctrl+Alt+S')
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    })
  })

  it('should handle save errors', async () => {
    const mockSetSetting = vi.fn().mockRejectedValue(new Error('Save failed'))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Save Settings'))
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should export settings', async () => {
    const mockExportSettings = vi.fn().mockResolvedValue('{"test": "data"}')
    useScratchPadStore.setState({ exportSettings: mockExportSettings })
    
    // Mock document methods
    const mockAppendChild = vi.fn()
    const mockRemoveChild = vi.fn()
    const mockClick = vi.fn()
    
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Export Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Export Settings'))
    
    await waitFor(() => {
      expect(mockExportSettings).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(screen.getByText('Settings exported successfully!')).toBeInTheDocument()
    })
  })

  it('should import settings', async () => {
    const mockImportSettings = vi.fn().mockResolvedValue(3)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      importSettings: mockImportSettings,
      getAllSettings: mockGetAllSettings
    })
    
    // Mock file input
    const mockFile = new File(['{"test": "data"}'], 'settings.json', { type: 'application/json' })
    const mockInput = {
      type: 'file',
      accept: '.json',
      onchange: null as any,
      click: vi.fn(),
      files: [mockFile]
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any)
    vi.spyOn(mockFile, 'text').mockResolvedValue('{"test": "data"}')
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Import Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Import Settings'))
    
    // Simulate file selection
    if (mockInput.onchange) {
      await mockInput.onchange({ target: mockInput } as any)
    }
    
    await waitFor(() => {
      expect(mockImportSettings).toHaveBeenCalledWith('{"test": "data"}')
      expect(screen.getByText('Successfully imported 3 settings!')).toBeInTheDocument()
    })
  })

  it('should reset settings to defaults', async () => {
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      resetSettingsToDefaults: mockResetSettings,
      getAllSettings: mockGetAllSettings
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Reset to Defaults'))
    
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to reset all settings to their default values? This action cannot be undone.'
      )
      expect(mockResetSettings).toHaveBeenCalled()
      expect(screen.getByText('Settings reset to defaults successfully!')).toBeInTheDocument()
    })
  })

  it('should not reset settings if user cancels', async () => {
    const mockResetSettings = vi.fn()
    useScratchPadStore.setState({ resetSettingsToDefaults: mockResetSettings })
    
    vi.mocked(window.confirm).mockReturnValue(false)
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Reset to Defaults'))
    
    expect(mockResetSettings).not.toHaveBeenCalled()
  })

  it('should clear validation errors when input changes', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Create validation error
    const widthInput = screen.getByDisplayValue('800')
    await user.clear(widthInput)
    await user.type(widthInput, '100')
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
    
    // Fix the error
    await user.clear(widthInput)
    await user.type(widthInput, '800')
    
    expect(screen.queryByText('Window width must be between 400 and 3840 pixels')).not.toBeInTheDocument()
  })

  it('should handle select field changes', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Inter')).toBeInTheDocument()
    })
    
    // This is a simplified test since Select components are complex to test
    // In a real scenario, you'd need to test the actual select interaction
    expect(screen.getByText('Inter')).toBeInTheDocument()
    expect(screen.getByText('Plain Text')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('should display error messages', async () => {
    useScratchPadStore.setState({ error: 'Test error message' })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
  })

  it('should handle loading errors gracefully', async () => {
    const mockGetAllSettings = vi.fn().mockRejectedValue(new Error('Load failed'))
    useScratchPadStore.setState({ getAllSettings: mockGetAllSettings })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should show saving state', async () => {
    const mockSetSetting = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('should validate fuzzy search threshold range', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
    })
    
    const thresholdInput = screen.getByDisplayValue('0.6')
    await user.clear(thresholdInput)
    await user.type(thresholdInput, '1.5') // Out of range
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Fuzzy search threshold must be between 0.0 and 1.0')).toBeInTheDocument()
  })

  it('should validate auto-save delay range', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    })
    
    const delayInput = screen.getByDisplayValue('500')
    await user.clear(delayInput)
    await user.type(delayInput, '50') // Too small
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Auto-save delay must be between 100 and 10000 milliseconds')).toBeInTheDocument()
  })

  it('should handle import errors', async () => {
    const mockImportSettings = vi.fn().mockRejectedValue(new Error('Import failed'))
    const mockSetError = vi.fn()
    
    useScratchPadStore.setState({
      importSettings: mockImportSettings,
      setError: mockSetError
    })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock file input
    const mockFile = new File(['invalid json'], 'settings.json', { type: 'application/json' })
    const mockInput = {
      type: 'file',
      accept: '.json',
      onchange: null as any,
      click: vi.fn(),
      files: [mockFile]
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any)
    vi.spyOn(mockFile, 'text').mockResolvedValue('invalid json')
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Import Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Import Settings'))
    
    if (mockInput.onchange) {
      await mockInput.onchange({ target: mockInput } as any)
    }
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to import settings:', expect.any(Error))
      expect(mockSetError).toHaveBeenCalledWith('Failed to import settings. Please check the file format.')
    })
    
    consoleSpy.mockRestore()
  })

  it('should auto-hide success messages', async () => {
    vi.useFakeTimers()
    
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Save Settings'))
    
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    })
    
    // Fast-forward time
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument()
    })
    
    vi.useRealTimers()
  })
})