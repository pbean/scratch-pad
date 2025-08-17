import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { useScratchPadStore } from '../../lib/store'

// Mock the store
vi.mock('../../lib/store', () => ({
  useScratchPadStore: vi.fn()
}))

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockStore = {
  setCurrentView: vi.fn(),
  getAllSettings: vi.fn(),
  setSetting: vi.fn(),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  resetSettingsToDefaults: vi.fn(),
  error: null,
  setError: vi.fn()
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useScratchPadStore as any).mockReturnValue(mockStore)
    
    // Mock default settings response
    mockStore.getAllSettings.mockResolvedValue({
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
    })
  })

  it('renders settings form with default values', async () => {
    render(<SettingsView />)
    
    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    // Check that all form fields are present
    expect(screen.getByLabelText('Global Shortcut')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /ui font/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /editor font/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /default note format/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /layout mode/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Window Width (px)')).toBeInTheDocument()
    expect(screen.getByLabelText('Window Height (px)')).toBeInTheDocument()
  })

  it('validates form inputs correctly', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    // Test invalid window width
    const widthInput = screen.getByLabelText('Window Width (px)')
    await act(async () => {
      fireEvent.change(widthInput, { target: { value: '100' } })
    })
    
    const saveButton = screen.getByText('Save Settings')
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Window width must be between 400 and 3840 pixels')).toBeInTheDocument()
    })
  })

  it('saves settings when form is valid', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    const saveButton = screen.getByText('Save Settings')
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockStore.setSetting).toHaveBeenCalledWith('global_shortcut', 'Ctrl+Shift+N')
      expect(mockStore.setSetting).toHaveBeenCalledWith('ui_font', 'Inter')
      expect(mockStore.setSetting).toHaveBeenCalledWith('editor_font', 'SauceCodePro Nerd Font')
    })
  })

  it('handles back navigation', async () => {
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    const backButton = screen.getByText('Back to Notes')
    await act(async () => {
      fireEvent.click(backButton)
    })

    expect(mockStore.setCurrentView).toHaveBeenCalledWith('note')
  })

  it('handles export settings', async () => {
    mockStore.exportSettings.mockResolvedValue('{"test": "data"}')
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    const exportButton = screen.getByText('Export Settings')
    await act(async () => {
      fireEvent.click(exportButton)
    })

    await waitFor(() => {
      expect(mockStore.exportSettings).toHaveBeenCalled()
    })
  })

  it('handles reset to defaults with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    render(<SettingsView />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ctrl+Shift+N')).toBeInTheDocument()
    })

    const resetButton = screen.getByText('Reset to Defaults')
    await act(async () => {
      fireEvent.click(resetButton)
    })

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(mockStore.resetSettingsToDefaults).toHaveBeenCalled()
      expect(mockStore.getAllSettings).toHaveBeenCalledTimes(2) // Initial load + reload after reset
    })
  })
})