"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { TabBar } from "./tab-bar"
import { StatusBar } from "./status-bar"
import { useScratchPadStore } from "@/lib/store"

export function NoteView() {
  const {
    notes,
    activeNoteId,
    getActiveNote,
    saveNote,
    setActiveNote,
    setCommandPaletteOpen,
    createNote,
    closeNote,
    setCurrentView,
  } = useScratchPadStore()

  const note = getActiveNote()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState(note?.content || "")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)

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

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (content !== note?.content) {
      setIsAutoSaving(true)
      try {
        saveNote(content)
        setLastSaved(new Date())
      } catch (error) {
        console.error("Failed to save note:", error)
      } finally {
        setIsAutoSaving(false)
      }
    }
  }, [content, note?.content, saveNote])

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(autoSave, 2000)
    return () => clearTimeout(timer)
  }, [content, autoSave])

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
        autoSave()
        return
      }

      // Close current tab
      if (isCtrl && e.key === "w") {
        e.preventDefault()
        if (notes.length > 1) {
          closeNote(activeNoteId)
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
  }, [setCommandPaletteOpen, setCurrentView, createNote, autoSave, closeNote, activeNoteId, notes, setActiveNote])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }

  const showTabs = notes.length > 1

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
          className="flex-1 w-full p-6 bg-background text-foreground font-mono text-sm leading-relaxed resize-none border-none outline-none focus:ring-0"
          placeholder={note ? "Start writing..." : "No note selected"}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        lastSaved={lastSaved}
        isAutoSaving={isAutoSaving}
        wordCount={content.split(/\s+/).filter(Boolean).length}
        charCount={content.length}
        lineCount={content.split("\n").length}
      />
    </div>
  )
}
