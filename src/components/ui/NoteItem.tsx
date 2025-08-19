import React from "react"
import { Note } from "../../types"

interface NoteItemProps {
  note: Note
  isActive?: boolean
  isSelected?: boolean
  onClick?: (note: Note) => void
  onFavoriteToggle?: (noteId: number) => void
  className?: string
  showFavoriteButton?: boolean
  showMetadata?: boolean
}

export const NoteItem = React.memo<NoteItemProps>(({
  note,
  isActive = false,
  isSelected = false,
  onClick,
  onFavoriteToggle,
  className = "",
  showFavoriteButton = true,
  showMetadata = true
}) => {
  const getNoteTitle = (noteParam: Note) => {
    if (noteParam.nickname) return noteParam.nickname
    const firstLine = noteParam.content.split("\n")[0].trim()
    return firstLine.substring(0, 50) || "Untitled"
  }

  const getPreviewText = (noteParam: Note) => {
    const lines = noteParam.content.split("\n")
    // Skip the first line if it's being used as title
    const contentLines = noteParam.nickname ? lines : lines.slice(1)
    return contentLines.join(" ").substring(0, 100).trim()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleClick = React.useCallback(() => {
    onClick?.(note)
  }, [onClick, note])

  const handleFavoriteClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onFavoriteToggle?.(note.id)
  }, [onFavoriteToggle, note.id])

  return (
    <div
      className={`
        group cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors
        ${isActive ? "bg-blue-50 border-blue-200" : ""}
        ${isSelected ? "bg-blue-100" : ""}
        ${className}
      `}
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {getNoteTitle(note)}
              </h3>
              {note.is_favorite && (
                <span className="text-yellow-500" title="Favorited">
                  ★
                </span>
              )}
            </div>
            
            {getPreviewText(note) && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {getPreviewText(note)}
              </p>
            )}
            
            {showMetadata && (
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>{formatDate(note.updated_at)}</span>
                <span>{note.content.length} chars</span>
                <span>
                  {note.format === "markdown" ? "Markdown" : "Plain Text"}
                </span>
              </div>
            )}
          </div>
          
          {showFavoriteButton && (
            <button
              onClick={handleFavoriteClick}
              className={`
                opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all
                ${note.is_favorite ? "opacity-100 text-yellow-500" : "text-gray-400"}
              `}
              title={note.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              ★
            </button>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.note.nickname === nextProps.note.nickname &&
    prevProps.note.is_favorite === nextProps.note.is_favorite &&
    prevProps.note.updated_at === nextProps.note.updated_at &&
    prevProps.note.format === nextProps.note.format &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showFavoriteButton === nextProps.showFavoriteButton &&
    prevProps.showMetadata === nextProps.showMetadata &&
    prevProps.className === nextProps.className
    // Functions are assumed to be stable from useCallback
  )
})

export default NoteItem