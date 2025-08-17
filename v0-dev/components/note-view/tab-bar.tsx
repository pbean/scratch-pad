"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useScratchPadStore } from "@/lib/store"

export function TabBar() {
  const { notes, activeNoteId, setActiveNote, closeNote } = useScratchPadStore()

  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle tab navigation when focus is on tab bar area
      if (!e.target || !(e.target as HTMLElement).closest(".tab-bar")) return

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const currentIndex = notes.findIndex((note) => note.id === activeNoteId)

        if (e.key === "ArrowLeft" && currentIndex > 0) {
          setActiveNote(notes[currentIndex - 1].id)
        } else if (e.key === "ArrowRight" && currentIndex < notes.length - 1) {
          setActiveNote(notes[currentIndex + 1].id)
        }
      }

      // Close tab with Delete key
      if (e.key === "Delete" && notes.length > 1) {
        e.preventDefault()
        closeNote(activeNoteId)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [notes, activeNoteId, setActiveNote, closeNote])

  const getTabTitle = (note: any) => {
    if (note.title && note.title !== "Untitled") {
      return note.title
    }
    // Extract first line or first few words as title
    const firstLine = note.content.split("\n")[0].trim()
    if (firstLine) {
      return firstLine.length > 20 ? firstLine.substring(0, 20) + "..." : firstLine
    }
    return "Untitled"
  }

  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    setDraggedTab(noteId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, noteId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverTab(noteId)
  }

  const handleDragLeave = () => {
    setDragOverTab(null)
  }

  const handleDrop = (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault()
    setDragOverTab(null)
    setDraggedTab(null)

    if (draggedTab && draggedTab !== targetNoteId) {
      // Handle tab reordering logic here
      console.log("Reorder tabs:", draggedTab, "->", targetNoteId)
    }
  }

  return (
    <div className="tab-bar flex items-center bg-card border-b border-border px-2 py-1 min-h-[40px]">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {notes.map((note, index) => (
          <div
            key={note.id}
            draggable
            tabIndex={0}
            onDragStart={(e) => handleDragStart(e, note.id)}
            onDragOver={(e) => handleDragOver(e, note.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, note.id)}
            className={`
              group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs cursor-pointer
              transition-colors duration-150 min-w-0 max-w-[200px] focus:outline-none focus:ring-2 focus:ring-ring
              ${
                note.id === activeNoteId
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }
              ${dragOverTab === note.id ? "ring-2 ring-primary" : ""}
            `}
            onClick={() => setActiveNote(note.id)}
            title={`${getTabTitle(note)} (Ctrl+${index + 1})`}
          >
            <span className="truncate flex-1 font-medium">{getTabTitle(note)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeNote(note.id)
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive rounded p-0.5 transition-all duration-150"
              title="Close tab (Ctrl+W)"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
