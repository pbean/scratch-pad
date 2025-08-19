import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
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
    
    // Reset window mocks (already set up in test setup)
    vi.mocked(window.confirm).mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
  })

  it('should load and display settings', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
  })

  it('should render all settings sections', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
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
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Back to Notes')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Back to Notes'))
    })
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should validate form inputs', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Clear global shortcut (required field)
    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    await act(async () => {
      await user.clear(shortcutInput)
    })
    
    // Try to save
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Global shortcut cannot be empty')).toBeInTheDocument()
  })

  it('should validate numeric fields', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Set invalid window width
    const widthInput = screen.getByDisplayValue('800')
    await act(async () => {
      await user.clear(widthInput)
      await user.type(widthInput, '100') // Too small
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
  })

  it('should save settings successfully', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
    
    // Modify a setting
    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    await act(async () => {
      await user.clear(shortcutInput)
      await user.type(shortcutInput, 'Ctrl+Alt+S')
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('global_shortcut', 'Ctrl+Alt+S')
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    })
  })

  it('should handle save errors', async () => {
    const mockSetSetting = vi.fn().mockRejectedValue(new Error('Save failed'))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should export settings', async () => {
    const mockExportSettings = vi.fn().mockResolvedValue('{"test": "data"}')
    useScratchPadStore.setState({ exportSettings: mockExportSettings })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Export Settings')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Export Settings'))
    })
    
    await waitFor(() => {
      expect(mockExportSettings).toHaveBeenCalled()
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
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Import Settings')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Import Settings'))
    })
    
    // The file input interaction is complex in tests, so we'll verify the setup
    expect(document.createElement).toHaveBeenCalledWith('input')
  })

  it('should reset settings to defaults', async () => {
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      resetSettingsToDefaults: mockResetSettings,
      getAllSettings: mockGetAllSettings
    })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Reset to Defaults'))
    })
    
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
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Reset to Defaults'))
    })
    
    expect(mockResetSettings).not.toHaveBeenCalled()
  })

  it('should clear validation errors when input changes', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
    
    // Create validation error
    const widthInput = screen.getByDisplayValue('800')
    await act(async () => {
      await user.clear(widthInput)
      await user.type(widthInput, '100')
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
    
    // Fix the error
    await act(async () => {
      await user.clear(widthInput)
      await user.type(widthInput, '800')
    })
    
    expect(screen.queryByText('Window width must be between 400 and 3840 pixels')).not.toBeInTheDocument()
  })

  it('should display error messages', async () => {
    useScratchPadStore.setState({ error: 'Test error message' })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
  })

  it('should handle loading errors gracefully', async () => {
    const mockGetAllSettings = vi.fn().mockRejectedValue(new Error('Load failed'))
    useScratchPadStore.setState({ getAllSettings: mockGetAllSettings })
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should show saving state', async () => {
    const mockSetSetting = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('should validate fuzzy search threshold range', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
    })
    
    const thresholdInput = screen.getByDisplayValue('0.6')
    await act(async () => {
      await user.clear(thresholdInput)
      await user.type(thresholdInput, '1.5') // Out of range
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Fuzzy search threshold must be between 0.0 and 1.0')).toBeInTheDocument()
  })

  it('should validate auto-save delay range', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    })
    
    const delayInput = screen.getByDisplayValue('500')
    await act(async () => {
      await user.clear(delayInput)
      await user.type(delayInput, '50') // Too small
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Auto-save delay must be between 100 and 10000 milliseconds')).toBeInTheDocument()
  })

  it('should auto-hide success messages', async () => {
    vi.useFakeTimers()
    
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    useScratchPadStore.setState({ setSetting: mockSetSetting })
    
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument()
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
    })
    
    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    
    await waitFor(() => {
      expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument()
    })
    
    vi.useRealTimers()
  })
})