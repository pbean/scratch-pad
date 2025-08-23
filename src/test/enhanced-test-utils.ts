import React from 'react'
import { render, act } from './test-utils'
import { useScratchPadStore } from '../lib/store'
import { vi } from 'vitest'

// Render with pre-set state (fixes timing issues)
export async function renderWithState(
  component: React.ReactElement,
  initialState?: Partial<any>
) {
  if (initialState) {
    // Set state BEFORE render to avoid race conditions
    await act(async () => {
      useScratchPadStore.setState(initialState)
    })
    // Wait for state to propagate
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  
  return render(component)
}

// Create properly mocked store
export function createMockStore() {
  return {
    // Core mocks that always resolve
    getAllSettings: vi.fn().mockResolvedValue({
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
    }),
    setSetting: vi.fn().mockResolvedValue(undefined),
    setCurrentView: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    createNote: vi.fn(),
    setActiveNote: vi.fn(),
    searchNotes: vi.fn().mockResolvedValue([]),
    exportSettings: vi.fn().mockResolvedValue('{}'),
    importSettings: vi.fn().mockResolvedValue(5),
    resetSettingsToDefaults: vi.fn().mockResolvedValue(undefined),
    toggleFolder: vi.fn(),
    loadMoreNotes: vi.fn(),
    setError: vi.fn(),
    getActiveNote: () => null,
  }
}

// Enhanced cleanup
export async function cleanupTestEnhanced() {
  // Clear all timers first
  vi.clearAllTimers()
  vi.useRealTimers()
  
  // Unmount all components - more aggressive cleanup
  document.body.innerHTML = ''
  const testRoot = document.getElementById('test-root')
  if (testRoot) {
    testRoot.remove()
  }
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Reset store
  const { getInitialState } = useScratchPadStore
  useScratchPadStore.setState(getInitialState())
  
  // Clear storage
  localStorage.clear()
  sessionStorage.clear()
  
  // Wait for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 0))
}