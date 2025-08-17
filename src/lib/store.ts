"use client"

import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Note, View, ApiError, LayoutMode } from "../types"

interface ScratchPadState {
  // Core state
  notes: Note[]
  activeNoteId: number | null
  currentView: View
  isCommandPaletteOpen: boolean
  isLoading: boolean
  error: string | null

  // UI state
  expandedFolders: Set<string>
  selectedSearchIndex: number
  searchQuery: string

  // Actions
  setCurrentView: (view: View) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveNote: (noteId: number) => void
  setError: (error: string | null) => void

  // Note management
  loadNotes: () => Promise<void>
  saveNote: (content: string) => Promise<void>
  createNote: (content?: string) => Promise<void>
  deleteNote: (noteId: number) => Promise<void>
  updateNote: (note: Note) => Promise<void>

  // Search
  setSearchQuery: (query: string) => void
  searchNotes: (query: string) => Promise<Note[]>
  setSelectedSearchIndex: (index: number) => void

  // UI helpers
  toggleFolder: (folderId: string) => void
  getActiveNote: () => Note | undefined

  // Global shortcut management
  getCurrentGlobalShortcut: () => Promise<string | null>
  registerGlobalShortcut: (shortcut: string) => Promise<void>
  unregisterGlobalShortcut: (shortcut: string) => Promise<void>
  updateGlobalShortcut: (oldShortcut: string, newShortcut: string) => Promise<void>
  testGlobalShortcut: (shortcut: string) => Promise<boolean>
  getSuggestedGlobalShortcuts: () => Promise<string[]>
  isGlobalShortcutRegistered: (shortcut: string) => Promise<boolean>

  // Window management
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  setLayoutMode: (mode: LayoutMode) => Promise<void>
  getLayoutMode: () => Promise<LayoutMode>
  centerWindow: () => Promise<void>
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
  isWindowVisible: () => Promise<boolean>
  isWindowFocused: () => Promise<boolean>

  // Settings management
  getAllSettings: () => Promise<Record<string, string>>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (jsonContent: string) => Promise<number>
  resetSettingsToDefaults: () => Promise<void>
  initializeSettings: () => Promise<void>

  // Plugin management
  getPluginInfo: () => Promise<Array<Record<string, string>>>
  getPluginCount: () => Promise<number>
  getAvailableNoteFormats: () => Promise<string[]>
  reloadPlugins: () => Promise<string>
}

export const useScratchPadStore = create<ScratchPadState>((set, get) => ({
  // Initial state
  notes: [],
  activeNoteId: null,
  currentView: "note",
  isCommandPaletteOpen: false,
  isLoading: false,
  error: null,
  expandedFolders: new Set(["recent", "all-notes"]),
  selectedSearchIndex: 0,
  searchQuery: "",

  // View actions
  setCurrentView: (view) => set({ currentView: view }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setActiveNote: (noteId) => set({ activeNoteId: noteId }),
  setError: (error) => set({ error }),

  // Note management
  loadNotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const notes = await invoke<Note[]>("get_all_notes")
      set({ 
        notes, 
        isLoading: false,
        // Set active note to the latest one if none is selected
        activeNoteId: get().activeNoteId || (notes.length > 0 ? notes[0].id : null)
      })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message, isLoading: false })
    }
  },

  saveNote: async (content: string) => {
    const { activeNoteId, notes } = get()
    if (!activeNoteId) return

    const activeNote = notes.find(note => note.id === activeNoteId)
    if (!activeNote) return

    try {
      const updatedNote = { ...activeNote, content }
      const result = await invoke<Note>("update_note", { note: updatedNote })
      
      set({
        notes: notes.map(note => 
          note.id === activeNoteId ? result : note
        )
      })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  createNote: async (content = "") => {
    set({ isLoading: true, error: null })
    try {
      const newNote = await invoke<Note>("create_note", { content })
      set(state => ({
        notes: [newNote, ...state.notes],
        activeNoteId: newNote.id,
        currentView: "note",
        isLoading: false
      }))
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message, isLoading: false })
    }
  },

  deleteNote: async (noteId: number) => {
    try {
      await invoke("delete_note", { id: noteId })
      const { notes, activeNoteId } = get()
      const newNotes = notes.filter(note => note.id !== noteId)
      
      let newActiveNoteId = activeNoteId
      if (noteId === activeNoteId) {
        newActiveNoteId = newNotes.length > 0 ? newNotes[0].id : null
      }

      set({
        notes: newNotes,
        activeNoteId: newActiveNoteId
      })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  updateNote: async (note: Note) => {
    try {
      const updatedNote = await invoke<Note>("update_note", { note })
      set(state => ({
        notes: state.notes.map(n => n.id === note.id ? updatedNote : n)
      }))
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  // Search
  setSearchQuery: (query) => set({ searchQuery: query, selectedSearchIndex: 0 }),

  searchNotes: async (query: string) => {
    try {
      const results = await invoke<Note[]>("combined_search_notes", { query })
      return results
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return []
    }
  },

  setSelectedSearchIndex: (index) => set({ selectedSearchIndex: index }),

  // UI helpers
  toggleFolder: (folderId) => {
    const { expandedFolders } = get()
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    set({ expandedFolders: newExpanded })
  },

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find(note => note.id === activeNoteId)
  },

  // Global shortcut management
  getCurrentGlobalShortcut: async () => {
    try {
      return await invoke<string | null>("get_current_global_shortcut")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return null
    }
  },

  registerGlobalShortcut: async (shortcut: string) => {
    try {
      await invoke("register_global_shortcut", { shortcut })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  unregisterGlobalShortcut: async (shortcut: string) => {
    try {
      await invoke("unregister_global_shortcut", { shortcut })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  updateGlobalShortcut: async (oldShortcut: string, newShortcut: string) => {
    try {
      await invoke("update_global_shortcut", { oldShortcut, newShortcut })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  testGlobalShortcut: async (shortcut: string) => {
    try {
      return await invoke<boolean>("test_global_shortcut", { shortcut })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return false
    }
  },

  getSuggestedGlobalShortcuts: async () => {
    try {
      return await invoke<string[]>("get_suggested_global_shortcuts")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return []
    }
  },

  isGlobalShortcutRegistered: async (shortcut: string) => {
    try {
      return await invoke<boolean>("is_global_shortcut_registered", { shortcut })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return false
    }
  },

  // Window management functions
  showWindow: async () => {
    try {
      await invoke("show_window")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  hideWindow: async () => {
    try {
      await invoke("hide_window")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  toggleWindow: async () => {
    try {
      await invoke("toggle_window")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  setLayoutMode: async (mode: LayoutMode) => {
    try {
      await invoke("set_layout_mode", { mode })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  getLayoutMode: async () => {
    try {
      return await invoke<string>("get_layout_mode") as LayoutMode
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return "default"
    }
  },

  centerWindow: async () => {
    try {
      await invoke("center_window")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  setAlwaysOnTop: async (alwaysOnTop: boolean) => {
    try {
      await invoke("set_always_on_top", { alwaysOnTop })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
    }
  },

  isWindowVisible: async () => {
    try {
      return await invoke<boolean>("is_window_visible")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return false
    }
  },

  isWindowFocused: async () => {
    try {
      return await invoke<boolean>("is_window_focused")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return false
    }
  },

  // Settings management
  getAllSettings: async () => {
    try {
      return await invoke<Record<string, string>>("get_all_settings")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return {}
    }
  },

  getSetting: async (key: string) => {
    try {
      return await invoke<string | null>("get_setting", { key })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return null
    }
  },

  setSetting: async (key: string, value: string) => {
    try {
      await invoke("set_setting", { key, value })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  exportSettings: async () => {
    try {
      return await invoke<string>("export_settings")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  importSettings: async (jsonContent: string) => {
    try {
      return await invoke<number>("import_settings", { jsonContent })
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  resetSettingsToDefaults: async () => {
    try {
      await invoke("reset_settings_to_defaults")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },

  initializeSettings: async () => {
    try {
      await invoke("initialize_default_settings")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      console.warn("Failed to initialize default settings:", apiError.message)
    }
  },

  // Plugin management
  getPluginInfo: async () => {
    try {
      return await invoke<Array<Record<string, string>>>("get_plugin_info")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return []
    }
  },

  getPluginCount: async () => {
    try {
      return await invoke<number>("get_plugin_count")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return 0
    }
  },

  getAvailableNoteFormats: async () => {
    try {
      return await invoke<string[]>("get_available_note_formats")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      return ["plaintext", "markdown"] // fallback to default formats
    }
  },

  reloadPlugins: async () => {
    try {
      return await invoke<string>("reload_plugins")
    } catch (error) {
      const apiError = error as ApiError
      set({ error: apiError.message })
      throw error
    }
  },
}))