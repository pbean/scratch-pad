import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '../../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { SettingsView } from '../SettingsView'
import { useScratchPadStore } from '../../../lib/store'
import { COMPONENT_TIMEOUTS, flushMicrotasks, setupStoreState } from '../../../test/setup'

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
    // Set up mocks BEFORE render using setupStoreState (synchronous)
    setupStoreState({
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

  // Helper function to wait for settings to fully load with proper timeout
  const waitForSettingsToLoad = async () => {
    // Wait for loading to complete - be more patient for component initialization
    await waitFor(() => {
      expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.complex })
    
    // Then wait for the shortcut field to appear with value - critical for form tests
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.complex })
    
    // Allow React to complete any remaining updates including performance components
    await act(async () => {
      await flushMicrotasks()
    })
  }

  it('should render loading state initially', async () => {
    // Mock a delayed response to see loading state
    const delayedGetAllSettings = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSettings), 100))
    )
    
    setupStoreState({
      getAllSettings: delayedGetAllSettings,
      setCurrentView: vi.fn(),
      setSetting: vi.fn().mockResolvedValue(undefined),
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(undefined),
      error: null,
      setError: vi.fn()
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    // Should see loading state immediately
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
    
    // Wait for settings to load with extended timeout
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.complex * 2 })
  })

  it('should load and display settings', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()
    
    // Check all key form values are present
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Inter')).toBeInTheDocument()
      expect(screen.getByDisplayValue('800')).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.complex })
  })

  it('should render all settings sections', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()
    
    // Check for all settings sections
    await waitFor(() => {
      expect(screen.getByText('Global Shortcut')).toBeInTheDocument()
      expect(screen.getByText('Font Preferences')).toBeInTheDocument()
      expect(screen.getByText('Note Format & Layout')).toBeInTheDocument()
      expect(screen.getByText('Window Settings')).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.complex })
  })

  it('should handle back button click', async () => {
    const mockSetCurrentView = vi.fn()
    setupStoreState({
      setCurrentView: mockSetCurrentView,
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(undefined),
      error: null,
      setError: vi.fn()
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const backButton = screen.getByRole('button', { name: /back to notes/i })
    
    await act(async () => {
      await userEvent.click(backButton)
    })

    expect(mockSetCurrentView).toHaveBeenCalledWith('note')
  })

  it('should handle setting changes', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: mockSetSetting,
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5)
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    // Find and change the global shortcut input
    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    
    await act(async () => {
      await userEvent.clear(shortcutInput)
      await userEvent.type(shortcutInput, 'Ctrl+Alt+S')
    })

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('global_shortcut', 'Ctrl+Alt+S')
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should show saving state', async () => {
    // Mock a slow setSetting to see saving state
    const slowSetSetting = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    )
    
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: slowSetSetting,
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5)
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    
    await act(async () => {
      await userEvent.clear(shortcutInput)
      await userEvent.type(shortcutInput, 'Ctrl+Alt+S')
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    // Should show saving state
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })

    // Wait for save to complete
    await waitFor(() => {
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should validate fuzzy search threshold range', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const thresholdInput = screen.getByDisplayValue('0.6')
    
    await act(async () => {
      await userEvent.clear(thresholdInput)
      await userEvent.type(thresholdInput, '1.5') // Invalid value > 1.0
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/fuzzy search threshold must be between 0.0 and 1.0/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should validate auto-save delay range', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const delayInput = screen.getByDisplayValue('500')
    
    await act(async () => {
      await userEvent.clear(delayInput)
      await userEvent.type(delayInput, '10') // Invalid value < 100
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/auto-save delay must be between 100 and 10000 milliseconds/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should auto-hide success messages', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue(undefined)
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      setSetting: mockSetSetting,
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5)
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    
    await act(async () => {
      await userEvent.clear(shortcutInput)
      await userEvent.type(shortcutInput, 'Ctrl+Alt+S')
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })

    // Success message should auto-hide after timeout
    await waitFor(() => {
      expect(screen.queryByText(/settings saved successfully/i)).not.toBeInTheDocument()
    }, { timeout: 4000 }) // Success messages auto-hide after 3 seconds
  })

  it('should handle export settings', async () => {
    const mockExportSettings = vi.fn().mockResolvedValue('{"exported": "settings"}')
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      exportSettings: mockExportSettings,
      importSettings: vi.fn().mockResolvedValue(5)
    })

    // Mock URL.createObjectURL and click
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const mockClick = vi.fn()
    HTMLAnchorElement.prototype.click = mockClick

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const exportButton = screen.getByRole('button', { name: /export settings/i })
    
    await act(async () => {
      await userEvent.click(exportButton)
    })

    await waitFor(() => {
      expect(mockExportSettings).toHaveBeenCalled()
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should handle import settings', async () => {
    const mockImportSettings = vi.fn().mockResolvedValue(5)
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      importSettings: mockImportSettings,
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}')
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    // Use more specific query for import button to avoid multiple elements
    const importButton = screen.getByRole('button', { name: /import settings/i })
    const file = new File(['{"test": "data"}'], 'settings.json', { type: 'application/json' })
    
    // Mock file input creation and trigger
    const mockFileInput = document.createElement('input')
    mockFileInput.type = 'file'
    const mockClick = vi.fn()
    mockFileInput.click = mockClick
    
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'input') {
        return mockFileInput as HTMLInputElement
      }
      return document.createElement(tag)
    })

    await act(async () => {
      await userEvent.click(importButton)
    })

    expect(mockClick).toHaveBeenCalled()
    
    // Simulate file selection
    await act(async () => {
      const changeEvent = new Event('change', { bubbles: true })
      Object.defineProperty(mockFileInput, 'files', {
        value: [file],
        writable: false,
      })
      mockFileInput.onchange?.(changeEvent as any)
    })

    await waitFor(() => {
      expect(mockImportSettings).toHaveBeenCalledWith('{"test": "data"}')
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should handle reset to defaults', async () => {
    const mockResetSettings = vi.fn().mockResolvedValue(undefined)
    setupStoreState({
      getAllSettings: vi.fn().mockResolvedValue(mockSettings),
      resetSettingsToDefaults: mockResetSettings,
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5)
    })

    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
    
    await act(async () => {
      await userEvent.click(resetButton)
    })

    await waitFor(() => {
      expect(mockResetSettings).toHaveBeenCalled()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should handle loading errors gracefully', async () => {
    const mockSetError = vi.fn()
    setupStoreState({
      getAllSettings: vi.fn().mockRejectedValue(new Error('Network error')),
      setError: mockSetError,
      error: 'Failed to load settings',
      exportSettings: vi.fn().mockResolvedValue('{"test": "settings"}'),
      importSettings: vi.fn().mockResolvedValue(5)
    })

    await act(async () => {
      render(<SettingsView />)
    })

    // Should eventually show the error state or continue with defaults
    await waitFor(() => {
      // Either error shows or component continues with defaults
      const hasError = screen.queryByText(/error/i) !== null
      const hasDefaults = screen.queryByDisplayValue('Ctrl+Shift+N') !== null
      expect(hasError || hasDefaults).toBe(true)
    }, { timeout: COMPONENT_TIMEOUTS.complex })
  })

  it('should render settings tabs', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    await waitFor(() => {
      // Use more specific selectors for tabs to avoid multiple elements
      expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /performance/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /monitoring/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /optimization/i })).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should switch between tabs', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const performanceTab = screen.getByRole('tab', { name: /performance/i })
    
    await act(async () => {
      await userEvent.click(performanceTab)
    })

    await waitFor(() => {
      expect(screen.getByText(/performance dashboard/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should handle form validation errors', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const shortcutInput = screen.getByDisplayValue('Ctrl+Shift+N')
    
    await act(async () => {
      await userEvent.clear(shortcutInput)
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/global shortcut cannot be empty/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })

  it('should validate window dimensions', async () => {
    await act(async () => {
      render(<SettingsView />)
    })
    
    await waitForSettingsToLoad()

    const widthInput = screen.getByDisplayValue('800')
    
    await act(async () => {
      await userEvent.clear(widthInput)
      await userEvent.type(widthInput, '200') // Invalid value < 400
    })

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    
    await act(async () => {
      await userEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/window width must be between 400 and 3840 pixels/i)).toBeInTheDocument()
    }, { timeout: COMPONENT_TIMEOUTS.standard })
  })
})