import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/test-utils'
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
  beforeEach(() => {
    // Set up mocks BEFORE render using setState
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

  it('should render loading state initially', async () => {
    // Mock a delayed response to see loading state
    const delayedGetAllSettings = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSettings), 100))
    )
    
    useScratchPadStore.setState({
      getAllSettings: delayedGetAllSettings,
      setCurrentView: vi.fn(),
      setSetting: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })

    render(<SettingsView />)
    
    // Should see loading state immediately
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
    
    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
  })

  it('should load and display settings - times out', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
  })

  it('should render all settings sections - times out', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Global Shortcut')).toBeInTheDocument()
      expect(screen.getByText('Font Preferences')).toBeInTheDocument()
      expect(screen.getByText('Note Format & Layout')).toBeInTheDocument()
      expect(screen.getByText('Window Settings')).toBeInTheDocument()
      expect(screen.getByText('Performance Settings')).toBeInTheDocument()
    })
  })

  it('should handle back button click - flaky', async () => {
    const user = userEvent.setup()
    const mockSetCurrentView = vi.fn()
    
    useScratchPadStore.setState({
      setCurrentView: mockSetCurrentView,
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Back to Notes')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Back to Notes'))
    
    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should validate form inputs', async () => {
    const user = userEvent.setup()
    
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

  it('should validate numeric fields - times out', async () => {
    const user = userEvent.setup()
    
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

  it('should save settings successfully - times out', async () => {
    const user = userEvent.setup()
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    
    useScratchPadStore.setState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: mockSetSetting,
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
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
    const user = userEvent.setup()
    const mockSetSetting = vi.fn().mockRejectedValue(new Error('Save failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    useScratchPadStore.setState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: mockSetSetting,
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
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

  it('should export settings - times out', async () => {
    const user = userEvent.setup()
    const mockExportSettings = vi.fn().mockResolvedValue('{"test": "data"}')
    
    useScratchPadStore.setState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      exportSettings: mockExportSettings,
      setSetting: vi.fn(),
      setCurrentView: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Export Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Export Settings'))
    
    await waitFor(() => {
      expect(mockExportSettings).toHaveBeenCalled()
      expect(screen.getByText('Settings exported successfully!')).toBeInTheDocument()
    })
  })

  it('should reset settings to defaults - times out', async () => {
    const user = userEvent.setup()
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    const mockGetAllSettings = vi.fn().mockResolvedValue(mockSettings)
    
    useScratchPadStore.setState({
      resetSettingsToDefaults: mockResetSettings,
      getAllSettings: mockGetAllSettings,
      setSetting: vi.fn(),
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      error: null,
      setError: vi.fn()
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
    const user = userEvent.setup()
    const mockResetSettings = vi.fn()
    
    vi.mocked(window.confirm).mockReturnValue(false)
    useScratchPadStore.setState({
      resetSettingsToDefaults: mockResetSettings,
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: vi.fn(),
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Reset to Defaults'))
    
    expect(mockResetSettings).not.toHaveBeenCalled()
  })

  it('should clear validation errors when input changes', async () => {
    const user = userEvent.setup()
    
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

  it('should display error messages', async () => {
    useScratchPadStore.setState({
      error: 'Test error message',
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: vi.fn(),
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
  })

  it('should handle loading errors gracefully', async () => {
    const mockGetAllSettings = vi.fn().mockRejectedValue(new Error('Load failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    useScratchPadStore.setState({
      getAllSettings: mockGetAllSettings,
      setSetting: vi.fn(),
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error))
    })
    
    consoleSpy.mockRestore()
  })

  it('should show saving state', async () => {
    const user = userEvent.setup()
    const mockSetSetting = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    useScratchPadStore.setState({
      setSetting: mockSetSetting,
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setCurrentView: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn(),
      resetSettingsToDefaults: vi.fn(),
      error: null,
      setError: vi.fn()
    })
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Save Settings'))
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('should validate fuzzy search threshold range', async () => {
    const user = userEvent.setup()
    
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

  it('should validate auto-save delay range - times out', async () => {
    const user = userEvent.setup()
    
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

  it('should auto-hide success messages - times out', async () => {
    vi.useFakeTimers()
    
    try {
      const user = userEvent.setup()
      const mockSetSetting = vi.fn().mockResolvedValue(undefined)
      
      useScratchPadStore.setState({
        setSetting: mockSetSetting,
        getAllSettings: vi.fn().mockResolvedValue(mockSettings),
        setCurrentView: vi.fn(),
        exportSettings: vi.fn(),
        importSettings: vi.fn(),
        resetSettingsToDefaults: vi.fn(),
        error: null,
        setError: vi.fn()
      })
      
      render(<SettingsView />)
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      
      // Click save settings button
      await user.click(screen.getByText('Save Settings'))
      
      // Wait for success message to appear
      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument()
      })
      
      // Fast-forward time to trigger auto-hide (component uses 3000ms timeout)
      vi.advanceTimersByTime(3100)
      
      // Wait for message to disappear
      await waitFor(() => {
        expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})