import React from "react"
import { LoadingSpinner } from "../ui/loading"

interface StatusBarProps {
  lastSaved: Date | null
  isAutoSaving: boolean
  saveStatus: "idle" | "saving" | "saved" | "error"
  wordCount: number
  charCount: number
  lineCount: number
  noteTitle: string
}

export const StatusBar = React.memo<StatusBarProps>(({ 
  lastSaved, 
  isAutoSaving,
  saveStatus,
  wordCount, 
  charCount, 
  lineCount,
  noteTitle 
}) => {
  const formatLastSaved = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return "Just now"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="font-medium truncate max-w-48">{noteTitle}</span>
        <span className={`flex items-center gap-1 ${saveStatus === "saving" ? "status-pulse" : ""}`}>
          {saveStatus === "saving" && <LoadingSpinner size="sm" className="w-3 h-3" />}
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "✓ Saved"}
          {saveStatus === "error" && "⚠ Save failed"}
          {saveStatus === "idle" && (lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : "Not saved")}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>{lineCount} lines</span>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.lastSaved?.getTime() === nextProps.lastSaved?.getTime() &&
    prevProps.isAutoSaving === nextProps.isAutoSaving &&
    prevProps.saveStatus === nextProps.saveStatus &&
    prevProps.wordCount === nextProps.wordCount &&
    prevProps.charCount === nextProps.charCount &&
    prevProps.lineCount === nextProps.lineCount &&
    prevProps.noteTitle === nextProps.noteTitle
  )
})