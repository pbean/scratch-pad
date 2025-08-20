import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Note, ApiError } from "../../../types"

export interface NotesSlice {
  // State
  notes: Note[]
  activeNoteId: number | null
  notesCount: number
  hasMoreNotes: boolean
  isLoadingNotes: boolean
  isLoadingMore: boolean
  optimisticUpdates: Map<number, Partial<Note>>
  
  // Actions
  setActiveNote: (noteId: number | null) => void
  loadNotes: () => Promise<void>
  loadMoreNotes: () => Promise<void>
  createNote: (content?: string) => Promise<void>
  updateNote: (note: Note) => Promise<void>
  updateNoteOptimistic: (noteId: number, updates: Partial<Note>) => void
  deleteNote: (noteId: number) => Promise<void>
  saveNote: (content: string) => Promise<void>
  saveNoteDebounced: (content: string) => void
  
  // Selectors
  getActiveNote: () => Note | undefined
  getNoteById: (id: number) => Note | undefined
  getNotesWithOptimisticUpdates: () => Note[]
}

// Debounced save implementation
let saveTimeoutId: NodeJS.Timeout | null = null

export const createNotesSlice: StateCreator<
  NotesSlice,
  [],
  [],
  NotesSlice
> = (set, get) => ({
  // Initial state
  notes: [],
  activeNoteId: null,
  notesCount: 0,
  hasMoreNotes: false,
  isLoadingNotes: false,
  isLoadingMore: false,
  optimisticUpdates: new Map(),

  // Actions
  setActiveNote: (noteId) => set({ activeNoteId: noteId }),

  loadNotes: async () => {
    set({ isLoadingNotes: true })
    try {
      const [notes, totalCount] = await Promise.all([
        invoke<Note[]>("get_all_notes"),
        invoke<number>("get_notes_count")
      ])

      set({
        notes,
        notesCount: totalCount,
        hasMoreNotes: notes.length < totalCount,
        isLoadingNotes: false,
        optimisticUpdates: new Map(), // Clear optimistic updates on fresh load
        // Set active note to the latest one if none is selected
        activeNoteId: get().activeNoteId || (notes.length > 0 ? notes[0].id : null)
      })
    } catch (error) {
      const apiError = error as ApiError
      set({ isLoadingNotes: false })
      throw apiError
    }
  },

  loadMoreNotes: async () => {
    const { notes, isLoadingMore, hasMoreNotes } = get()
    if (isLoadingMore || !hasMoreNotes) return

    set({ isLoadingMore: true })
    try {
      const moreNotes = await invoke<Note[]>("get_notes_paginated", {
        offset: notes.length,
        limit: 50
      })

      set({
        notes: [...notes, ...moreNotes],
        hasMoreNotes: moreNotes.length === 50,
        isLoadingMore: false
      })
    } catch (error) {
      const apiError = error as ApiError
      set({ isLoadingMore: false })
      throw apiError
    }
  },

  createNote: async (content = "") => {
    set({ isLoadingNotes: true })
    try {
      const newNote = await invoke<Note>("create_note", { content })
      set(state => ({
        notes: [newNote, ...state.notes],
        activeNoteId: newNote.id,
        notesCount: state.notesCount + 1,
        isLoadingNotes: false
      }))
    } catch (error) {
      const apiError = error as ApiError
      set({ isLoadingNotes: false })
      throw apiError
    }
  },

  updateNote: async (note: Note) => {
    try {
      const updatedNote = await invoke<Note>("update_note", { note })
      set(state => {
        const newOptimisticUpdates = new Map(state.optimisticUpdates)
        newOptimisticUpdates.delete(note.id) // Remove optimistic update once confirmed
        
        return {
          notes: state.notes.map(n => n.id === note.id ? updatedNote : n),
          optimisticUpdates: newOptimisticUpdates
        }
      })
    } catch (error) {
      // Remove optimistic update on error
      set(state => {
        const newOptimisticUpdates = new Map(state.optimisticUpdates)
        newOptimisticUpdates.delete(note.id)
        return { optimisticUpdates: newOptimisticUpdates }
      })
      const apiError = error as ApiError
      throw apiError
    }
  },

  updateNoteOptimistic: (noteId: number, updates: Partial<Note>) => {
    set(state => {
      const newOptimisticUpdates = new Map(state.optimisticUpdates)
      const currentUpdates = newOptimisticUpdates.get(noteId) || {}
      newOptimisticUpdates.set(noteId, { ...currentUpdates, ...updates })
      return { optimisticUpdates: newOptimisticUpdates }
    })
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

      set(state => {
        const newOptimisticUpdates = new Map(state.optimisticUpdates)
        newOptimisticUpdates.delete(noteId)
        
        return {
          notes: newNotes,
          activeNoteId: newActiveNoteId,
          notesCount: Math.max(0, state.notesCount - 1),
          optimisticUpdates: newOptimisticUpdates
        }
      })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
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
      
      set(state => {
        const newOptimisticUpdates = new Map(state.optimisticUpdates)
        newOptimisticUpdates.delete(activeNoteId)
        
        return {
          notes: state.notes.map(note => 
            note.id === activeNoteId ? result : note
          ),
          optimisticUpdates: newOptimisticUpdates
        }
      })
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  saveNoteDebounced: (content: string) => {
    const { activeNoteId, updateNoteOptimistic } = get()
    if (!activeNoteId) return

    // Apply optimistic update immediately
    updateNoteOptimistic(activeNoteId, { 
      content, 
      updated_at: new Date().toISOString() 
    })

    // Clear existing timeout
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId)
    }

    // Set new timeout for actual save
    saveTimeoutId = setTimeout(() => {
      get().saveNote(content)
    }, 500) // Reduced from 1000ms for better responsiveness
  },

  // Selectors
  getActiveNote: () => {
    const { notes, activeNoteId, optimisticUpdates } = get()
    if (activeNoteId === null) return undefined
    
    const baseNote = notes.find(note => note.id === activeNoteId)
    if (!baseNote) return undefined

    const optimisticUpdate = optimisticUpdates.get(activeNoteId)
    return optimisticUpdate ? { ...baseNote, ...optimisticUpdate } : baseNote
  },

  getNoteById: (id: number) => {
    const { notes, optimisticUpdates } = get()
    const baseNote = notes.find(note => note.id === id)
    if (!baseNote) return undefined

    const optimisticUpdate = optimisticUpdates.get(id)
    return optimisticUpdate ? { ...baseNote, ...optimisticUpdate } : baseNote
  },

  getNotesWithOptimisticUpdates: () => {
    const { notes, optimisticUpdates } = get()
    return notes.map(note => {
      const optimisticUpdate = optimisticUpdates.get(note.id)
      return optimisticUpdate ? { ...note, ...optimisticUpdate } : note
    })
  }
})