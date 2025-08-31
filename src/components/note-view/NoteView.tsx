import { useEffect, useRef, useState, useCallback } from "react"
import { TabBar } from "./TabBar"
import { StatusBar } from "./StatusBar"
import { useScratchPadStore } from "../../lib/store"
import { useSmartAutoSave } from "../../hooks/useSmartAutoSave"
import { invoke } from "@tauri-apps/api/core"

export function NoteView() {
  const {
    notes,
    activeNoteId,
    getActiveNote,
    saveNote,
    setActiveNote,
    setCommandPaletteOpen,
    createNote,
    deleteNote,
    setCurrentView,
  } = useScratchPadStore()

  const note = getActiveNote()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState(note?.content || "")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  
  // Smart auto-save hook
  const smartAutoSave = useSmartAutoSave({
    onSave: async (content: string) => {
      setSaveStatus("saving")
      try {
        await saveNote(content)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2000)
      } catch (error) {
        console.error("Failed to save note:", error)
        setSaveStatus("error")
        setTimeout(() => setSaveStatus("idle"), 3000)
      }
    },
    minDelay: 300,    // Quick saves when idle
    maxDelay: 2000,   // Longer delay when typing fast
    idleThreshold: 1500,
    fastTypingThreshold: 5
  })

  // Auto-focus the textarea when component mounts or note changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [activeNoteId])

  // Update content when note changes
  useEffect(() => {
    setContent(note?.content || "")
  }, [note?.content])

  // Smart auto-save when content changes
  useEffect(() => {
    if (content !== note?.content && note && content.trim()) {
      smartAutoSave.saveContent(content)
    }
  }, [content, note?.content, note, smartAutoSave])

  // Force save function for manual saves
  const forceSave = useCallback(async () => {
    if (content !== note?.content && note) {
      try {
        await smartAutoSave.forceSave(content)
      } catch (error) {
        console.error("Failed to force save note:", error)
      }
    }
  }, [content, note?.content, note, smartAutoSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey

      // Command Palette
      if (isCtrl && e.key === "p") {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      // Search/History View
      if (isCtrl && e.shiftKey && e.key === "F") {
        e.preventDefault()
        setCurrentView("search-history")
        return
      }

      // New Note
      if (isCtrl && e.key === "n") {
        e.preventDefault()
        createNote()
        return
      }

      // Save (manual save even though auto-save is enabled)
      if (isCtrl && e.key === "s") {
        e.preventDefault()
        forceSave()
        return
      }

      // Close current tab
      if (isCtrl && e.key === "w") {
        e.preventDefault()
        if (notes.length > 1 && activeNoteId) {
          deleteNote(activeNoteId)
        }
        return
      }

      // Tab navigation with Ctrl+Tab and Ctrl+Shift+Tab
      if (isCtrl && e.key === "Tab") {
        e.preventDefault()
        const currentIndex = notes.findIndex((note) => note.id === activeNoteId)
        if (e.shiftKey) {
          // Previous tab
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : notes.length - 1
          setActiveNote(notes[prevIndex].id)
        } else {
          // Next tab
          const nextIndex = currentIndex < notes.length - 1 ? currentIndex + 1 : 0
          setActiveNote(notes[nextIndex].id)
        }
        return
      }

      // Switch to tab by number (Ctrl+1, Ctrl+2, etc.)
      if (isCtrl && e.key >= "1" && e.key <= "9") {
        e.preventDefault()
        const tabIndex = Number.parseInt(e.key) - 1
        if (tabIndex < notes.length) {
          setActiveNote(notes[tabIndex].id)
        }
        return
      }

      // Layout mode shortcuts (Ctrl+1, Ctrl+2, Ctrl+3 for layout modes)
      if (isCtrl && e.altKey) {
        if (e.key === "1") {
          e.preventDefault()
          // Set default layout mode
          invoke("set_layout_mode", { mode: "default" }).catch(console.error)
          return
        }
        if (e.key === "2") {
          e.preventDefault()
          // Set half layout mode
          invoke("set_layout_mode", { mode: "half" }).catch(console.error)
          return
        }
        if (e.key === "3") {
          e.preventDefault()
          // Set full layout mode
          invoke("set_layout_mode", { mode: "full" }).catch(console.error)
          return
        }
      }

      // Focus search in current view (Ctrl+F)
      if (isCtrl && e.key === "f") {
        e.preventDefault()
        // This would focus a find-in-page functionality if implemented
        console.log("Find in current note (not implemented)")
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [setCommandPaletteOpen, setCurrentView, createNote, forceSave, deleteNote, activeNoteId, notes, setActiveNote])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }

  const showTabs = notes.length > 1

  // Helper function to get note title
  const getNoteTitle = (noteParam: typeof note) => {
    if (!noteParam) return "No note"
    if (noteParam.nickname) return noteParam.nickname
    const firstLine = noteParam.content.split("\n")[0].trim()
    return firstLine.substring(0, 50) || "Untitled"
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar - only visible when more than one note is open */}
      {showTabs && <TabBar />}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          className="flex-1 w-full p-6 font-mono text-sm leading-relaxed resize-none border-none outline-none focus-glow smooth-transition fade-in"
          style={{
            backgroundColor: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))'
          }}
          placeholder={note ? "Start writing..." : "No note selected"}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        lastSaved={smartAutoSave.lastSaved}
        isAutoSaving={smartAutoSave.isSaving}
        saveStatus={saveStatus}
        wordCount={content.split(/\s+/).filter(Boolean).length}
        charCount={content.length}
        lineCount={content.split("\n").length}
        noteTitle={getNoteTitle(note)}
      />
    </div>
  )
}