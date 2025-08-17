import { X } from "lucide-react"
import { useScratchPadStore } from "../../lib/store"

export function TabBar() {
  const { notes, activeNoteId, setActiveNote, deleteNote } = useScratchPadStore()

  const getNoteTitle = (note: typeof notes[0]) => {
    if (note.nickname) return note.nickname
    const firstLine = note.content.split("\n")[0].trim()
    return firstLine.substring(0, 30) || "Untitled"
  }

  const handleCloseTab = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation()
    if (notes.length > 1) {
      deleteNote(noteId)
    }
  }

  return (
    <div className="flex border-b border-border bg-muted/30">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`
            flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-border min-w-0 max-w-48
            ${note.id === activeNoteId 
              ? "bg-background text-foreground" 
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }
          `}
          onClick={() => setActiveNote(note.id)}
        >
          <span className="truncate text-sm">{getNoteTitle(note)}</span>
          {notes.length > 1 && (
            <button
              onClick={(e) => handleCloseTab(e, note.id)}
              className="p-1 hover:bg-muted-foreground/20 rounded"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}