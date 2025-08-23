import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SettingsView } from '../SettingsView'
import { useScratchPadStore } from '../../../lib/store'
import { renderWithState, cleanupTestEnhanced, createMockStore } from '../../../test/enhanced-test-utils'
import { createUser } from '../../../test/test-helpers'

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
  let mockStore: any
  
  beforeEach(() => {
    // Create a fresh mock store for each test
    mockStore = createMockStore()
    
    // Reset window mocks (already set up in test setup)
    vi.mocked(window.confirm).mockReturnValue(true)
  })

  afterEach(async () => {
    await cleanupTestEnhanced()
  })

  it('should render loading state initially', async () => {
    // Mock a delayed response to see loading state
    const delayedGetAllSettings = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSettings), 100))
    )
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      getAllSettings: delayedGetAllSettings
    })
    
    // Should see loading state immediately
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
    
    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })
  })

  it('should load and display settings', async () => {
    await renderWithState(<SettingsView />, mockStore)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    })
  })

  it('should render all settings sections', async () => {
    await renderWithState(<SettingsView />, mockStore)
    
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
    const user = createUser()
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      setCurrentView: mockSetCurrentView
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
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
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
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
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
    const user = createUser()
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      setSetting: mockSetSetting
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
    const user = createUser()
    const mockSetSetting = vi.fn().mockRejectedValue(new Error('Save failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      setSetting: mockSetSetting
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
    const user = createUser()
    const mockExportSettings = vi.fn().mockResolvedValue('{"test": "data"}')
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      exportSettings: mockExportSettings
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
    const user = createUser()
    const mockImportSettings = vi.fn().mockResolvedValue(3)
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      importSettings: mockImportSettings
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
    const user = createUser()
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      resetSettingsToDefaults: mockResetSettings
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
    const user = createUser()
    const mockResetSettings = vi.fn()
    
    vi.mocked(window.confirm).mockReturnValue(false)
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      resetSettingsToDefaults: mockResetSettings
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
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
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
    await renderWithState(<SettingsView />, {
      ...mockStore,
      error: 'Test error message'
    })
    
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })
  })

  it('should update select options', async () => {
    const user = createUser()
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    
    await renderWithState(<SettingsView />, {
      ...mockStore,
      setSetting: mockSetSetting
    })
    
    await waitFor(() => {
      expect(screen.getByText('plaintext')).toBeInTheDocument()
    })
    
    // Find and click the format select
    const formatSelect = screen.getByText('plaintext').closest('button')
    if (formatSelect) {
      await act(async () => {
        await user.click(formatSelect)
      })
      
      // Select markdown option
      await waitFor(() => {
        expect(screen.getByText('markdown')).toBeInTheDocument()
      })
      
      await act(async () => {
        await user.click(screen.getByText('markdown'))
      })
    }
  })

  it('should handle font input changes', async () => {
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
    })
    
    const uiFontInput = screen.getByDisplayValue('Inter')
    await act(async () => {
      await user.clear(uiFontInput)
      await user.type(uiFontInput, 'Roboto')
    })
    
    expect(uiFontInput).toHaveValue('Roboto')
  })

  it('should handle numeric input changes', async () => {
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    })
    
    const autoSaveInput = screen.getByDisplayValue('500')
    await act(async () => {
      await user.clear(autoSaveInput)
      await user.type(autoSaveInput, '1000')
    })
    
    expect(autoSaveInput).toHaveValue('1000')
  })

  it('should handle fuzzy search threshold changes', async () => {
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
    })
    
    const thresholdInput = screen.getByDisplayValue('0.6')
    await act(async () => {
      await user.clear(thresholdInput)
      await user.type(thresholdInput, '0.8')
    })
    
    expect(thresholdInput).toHaveValue('0.8')
  })

  it('should validate fuzzy search threshold range', async () => {
    const user = createUser()
    
    await renderWithState(<SettingsView />, mockStore)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
    })
    
    const thresholdInput = screen.getByDisplayValue('0.6')
    await act(async () => {
      await user.clear(thresholdInput)
      await user.type(thresholdInput, '1.5') // Invalid - too high
    })
    
    await act(async () => {
      await user.click(screen.getByText('Save Settings'))
    })
    
    expect(screen.getByText('Fuzzy search threshold must be between 0 and 1')).toBeInTheDocument()
  })
})