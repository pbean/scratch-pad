"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type View = "note" | "search-history"

export interface Note {
  id: string
  title: string
  content: string
  lastModified: Date
  path?: string
}

interface ScratchPadState {
  // Core state
  notes: Note[]
  activeNoteId: string
  currentView: View
  isCommandPaletteOpen: boolean

  // UI state
  expandedFolders: Set<string>
  selectedSearchIndex: number
  searchQuery: string

  // Actions
  setCurrentView: (view: View) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveNote: (noteId: string) => void

  // Note management
  saveNote: (content: string) => void
  createNote: () => void
  closeNote: (noteId: string) => void
  selectNote: (noteId: string, newTab?: boolean) => void

  // Search
  setSearchQuery: (query: string) => void
  searchNotes: (query: string) => Note[]
  setSelectedSearchIndex: (index: number) => void

  // UI helpers
  toggleFolder: (folderId: string) => void
  getActiveNote: () => Note | undefined
}

export const useScratchPadStore = create<ScratchPadState>()(
  persist(
    (set, get) => ({
      // Initial state
      notes: [
        {
          id: "1",
          title: "Welcome",
          content:
            "Welcome to Scratch Pad!\n\nThis is your minimalist, keyboard-driven notepad for developers.\n\n## Keyboard Shortcuts:\n- Ctrl+P: Command palette\n- Ctrl+Shift+F: Search notes\n- Ctrl+N: New note\n- Ctrl+W: Close tab\n- Ctrl+Tab: Next tab\n- Ctrl+Shift+Tab: Previous tab\n- Ctrl+1-9: Switch to tab by number\n- Ctrl+S: Manual save",
          lastModified: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          id: "2",
          title: "Meeting Notes",
          content:
            "# Team Meeting - Project Planning\n\n## Agenda\n- Review current progress\n- Discuss upcoming features\n- Assign tasks\n\n## Action Items\n- [ ] Update documentation\n- [ ] Fix bug in authentication\n- [ ] Prepare demo for client",
          lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
          id: "3",
          title: "Code Snippets",
          content:
            "// Useful React hooks\n\nconst useLocalStorage = (key, initialValue) => {\n  const [storedValue, setStoredValue] = useState(() => {\n    try {\n      const item = window.localStorage.getItem(key);\n      return item ? JSON.parse(item) : initialValue;\n    } catch (error) {\n      return initialValue;\n    }\n  });\n\n  const setValue = (value) => {\n    try {\n      setStoredValue(value);\n      window.localStorage.setItem(key, JSON.stringify(value));\n    } catch (error) {\n      console.error(error);\n    }\n  };\n\n  return [storedValue, setValue];\n};",
          lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
        {
          id: "4",
          title: "",
          content: "Quick draft note with minimal content",
          lastModified: new Date(Date.now() - 1000 * 60 * 10),
        },
      ],
      activeNoteId: "1",
      currentView: "note",
      isCommandPaletteOpen: false,
      expandedFolders: new Set(["recent", "all-notes"]),
      selectedSearchIndex: 0,
      searchQuery: "",

      // View actions
      setCurrentView: (view) => set({ currentView: view }),
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
      setActiveNote: (noteId) => set({ activeNoteId: noteId }),

      // Note management
      saveNote: (content) => {
        const { notes, activeNoteId } = get()
        const activeNote = notes.find((note) => note.id === activeNoteId)
        if (activeNote) {
          set({
            notes: notes.map((note) =>
              note.id === activeNoteId ? { ...note, content, lastModified: new Date() } : note,
            ),
          })
        }
      },

      createNote: () => {
        const newNote: Note = {
          id: Date.now().toString(),
          title: "",
          content: "",
          lastModified: new Date(),
        }
        set((state) => ({
          notes: [...state.notes, newNote],
          activeNoteId: newNote.id,
          currentView: "note",
        }))
      },

      closeNote: (noteId) => {
        const { notes, activeNoteId } = get()
        if (notes.length <= 1) return

        const noteIndex = notes.findIndex((note) => note.id === noteId)
        const newNotes = notes.filter((note) => note.id !== noteId)

        let newActiveNoteId = activeNoteId
        if (noteId === activeNoteId) {
          const newActiveIndex = noteIndex > 0 ? noteIndex - 1 : 0
          newActiveNoteId = newNotes[newActiveIndex].id
        }

        set({
          notes: newNotes,
          activeNoteId: newActiveNoteId,
        })
      },

      selectNote: (noteId, newTab = false) => {
        if (newTab) {
          console.log("Would open in new tab:", noteId)
        }
        set({
          activeNoteId: noteId,
          currentView: "note",
        })
      },

      // Search
      setSearchQuery: (query) => set({ searchQuery: query, selectedSearchIndex: 0 }),

      searchNotes: (query) => {
        const { notes } = get()
        return notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase()),
        )
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
        return notes.find((note) => note.id === activeNoteId)
      },
    }),
    {
      name: "scratch-pad-storage",
      partialize: (state) => ({
        notes: state.notes,
        activeNoteId: state.activeNoteId,
        expandedFolders: Array.from(state.expandedFolders), // Convert Set to Array for serialization
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.expandedFolders)) {
          // Convert Array back to Set after rehydration
          state.expandedFolders = new Set(state.expandedFolders)
        }
      },
    },
  ),
)
