import React from "react"
import { X } from "lucide-react"
import { useScratchPadStore } from "../../lib/store"
import { Note } from "../../types"

interface TabItemProps {
  note: Note
  isActive: boolean
  showCloseButton: boolean
  onSelect: (noteId: number) => void
  onClose: (e: React.MouseEvent, noteId: number) => void
}

const TabItem = React.memo<TabItemProps>(({ note, isActive, showCloseButton, onSelect, onClose }) => {
  const getNoteTitle = (noteParam: Note) => {
    if (noteParam.nickname) return noteParam.nickname
    const firstLine = noteParam.content.split("\n")[0].trim()
    return firstLine.substring(0, 30) || "Untitled"
  }

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-border min-w-0 max-w-48 smooth-transition
        ${isActive 
          ? "bg-background text-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover-lift"
        }
      `}
      onClick={() => onSelect(note.id)}
    >
      <span className="truncate text-sm">{getNoteTitle(note)}</span>
      {showCloseButton && (
        <button
          onClick={(e) => onClose(e, note.id)}
          className="p-1 hover:bg-muted-foreground/20 rounded smooth-transition opacity-60 hover:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal memoization
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.note.nickname === nextProps.note.nickname &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.showCloseButton === nextProps.showCloseButton
    // Functions are stable from useCallback, so we don't need to compare them
  )
})

export const TabBar = React.memo(() => {
  const { notes, activeNoteId, setActiveNote, deleteNote } = useScratchPadStore()

  const handleCloseTab = React.useCallback((e: React.MouseEvent, noteId: number) => {
    e.stopPropagation()
    if (notes.length > 1) {
      deleteNote(noteId)
    }
  }, [notes.length, deleteNote])

  const handleSelectTab = React.useCallback((noteId: number) => {
    setActiveNote(noteId)
  }, [setActiveNote])

  const showCloseButton = notes.length > 1

  return (
    <div className="flex border-b border-border bg-muted/30">
      {notes.map((note) => (
        <TabItem
          key={note.id}
          note={note}
          isActive={note.id === activeNoteId}
          showCloseButton={showCloseButton}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
        />
      ))}
    </div>
  )
}, (/* prevProps, nextProps */) => {
  // TabBar has no props, so it only re-renders when store data changes
  // The memo is mainly to prevent unnecessary re-renders from parent components
  return true // Always equal since no props
})